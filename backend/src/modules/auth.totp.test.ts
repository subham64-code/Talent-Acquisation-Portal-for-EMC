import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Never send real email during tests.
vi.mock("../integrations/email/email.service", () => ({
  sendTemplateEmail: vi.fn().mockResolvedValue({ status: "SIMULATED" }),
  sendEmail: vi.fn().mockResolvedValue({ status: "SIMULATED" }),
  emailSimulated: () => true,
}));

import { prisma } from "../lib/prisma";
import authRoutes from "./auth";
import usersRoutes from "./users";
import { errorHandler } from "../middleware/error";
import { hashPassword, randomToken, sha256 } from "../utils/crypto";
import { verifyAuthToken } from "../utils/jwt";
import { currentTotpStep, encryptTotpSecret, generateTotpCodeForTest, generateTotpSecret } from "../utils/totp";

vi.setConfig({ testTimeout: 30000, hookTimeout: 60000 });

const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json());
app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1", authRoutes);
app.use("/api/v1", usersRoutes);
app.use(errorHandler);

let ipCounter = 0;
function freshIp() {
  ipCounter += 1;
  return `10.42.${Math.floor(ipCounter / 200) % 200}.${ipCounter % 200}`;
}
function call(method: "get" | "post", path: string) {
  const r = request(app)[method](path).set("X-Forwarded-For", freshIp());
  return r;
}

const stamp = Date.now().toString(36);
const emails = {
  flow: `totp-flow-${stamp}@example.com`,
  login: `totp-login-${stamp}@example.com`,
  nonHr: `totp-nonhr-${stamp}@example.com`,
  inactive: `totp-inactive-${stamp}@example.com`,
  admin: `totp-admin-${stamp}@example.com`,
  unknown: `totp-unknown-${stamp}@example.com`,
};

const ids: Record<string, string> = {};
let roleIds: Record<string, string> = {};
let flowEnrollmentToken = "";
let flowSecret = "";
let loginSecret = "";
let loginCode = "";
let loginToken = "";
let liveSessionToken = "";
let adminToken = "";

async function createUser(email: string, roleKey: string, options: { active?: boolean; password?: string } = {}) {
  const user = await prisma.user.create({
    data: {
      email,
      name: `TOTP Test ${roleKey}`,
      isActive: options.active ?? true,
      ...(options.password ? { passwordHash: hashPassword(options.password) } : {}),
      roles: { create: { roleId: roleIds[roleKey]! } },
    },
  });
  return user;
}

async function enrollDirectly(userId: string) {
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEncrypted: encryptTotpSecret(secret),
      totpEnabled: true,
      totpEnrollmentPending: false,
      totpEnabledAt: new Date(),
      totpLastUsedStep: null,
      failedTotpAttempts: 0,
      lockedUntil: null,
    },
  });
  return secret;
}

function codeFor(secret: string, stepOffset = 0) {
  return generateTotpCodeForTest(secret, (currentTotpStep() + stepOffset) * 30 + 1);
}

beforeAll(async () => {
  const roles = await prisma.role.findMany({ where: { key: { in: ["HR_ADMIN", "HR_RECRUITER", "DEPARTMENT_MANAGER", "IT_ADMIN"] } } });
  roleIds = Object.fromEntries(roles.map((r) => [r.key, r.id]));

  ids.flow = (await createUser(emails.flow, "HR_ADMIN")).id;
  ids.login = (await createUser(emails.login, "HR_ADMIN")).id;
  ids.nonHr = (await createUser(emails.nonHr, "DEPARTMENT_MANAGER")).id;
  ids.inactive = (await createUser(emails.inactive, "HR_RECRUITER", { active: false })).id;
  ids.admin = (await createUser(emails.admin, "IT_ADMIN", { password: "TestAdmin123" })).id;

  flowEnrollmentToken = `enroll-flow-${randomToken(24)}`;
  await prisma.totpEnrollment.create({
    data: {
      userId: ids.flow,
      tokenHash: sha256(flowEnrollmentToken),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  loginSecret = await enrollDirectly(ids.login);

  const passwordLogin = await call("post", "/api/v1/auth/password/login").send({ email: emails.admin, password: "TestAdmin123" });
  adminToken = passwordLogin.body?.data?.token;
}, 60000);

afterAll(async () => {
  const allEmails = Object.values(emails);
  const allIds = Object.values(ids);
  const cleanup = [
    () => prisma.emailLog.deleteMany({ where: { toEmail: { in: allEmails } } }),
    () => prisma.auditLog.deleteMany({ where: { actorEmail: { in: allEmails } } }),
    () => prisma.authSession.deleteMany({ where: { userId: { in: allIds } } }),
    () => prisma.totpEnrollment.deleteMany({ where: { userId: { in: allIds } } }),
    () => prisma.notification.deleteMany({ where: { recipientUserId: { in: allIds } } }),
    () => prisma.notificationPreference.deleteMany({ where: { userId: { in: allIds } } }),
    () => prisma.user.deleteMany({ where: { id: { in: allIds } } }),
  ];
  for (const step of cleanup) {
    try { await step(); } catch { /* best-effort cleanup; never fail the run */ }
  }
  await prisma.$disconnect();
}, 60000);

describe("TOTP-only HR authentication (integration)", () => {
  it("keeps existing public and IT admin password authentication working", async () => {
    const health = await call("get", "/api/v1/health");
    expect(health.status).toBe(200);
    expect(adminToken).toBeTruthy();
  });

  it("rejects an unregistered email without revealing account details", async () => {
    const res = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.unknown });
    expect(res.status).toBe(403);
    expect(res.body.data ?? res.body.error?.message).toBeTruthy();
  });

  it("rejects non-HR users on the HR login", async () => {
    const res = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.nonHr });
    expect(res.status).toBe(403);
  });

  it("rejects a deactivated HR account", async () => {
    const res = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.inactive });
    expect(res.status).toBe(403);
  });

  it("blocks dashboard access until enrollment is complete", async () => {
    const check = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.flow });
    expect(check.status).toBe(200);
    expect(check.body.data.status).toBe("ENROLLMENT_REQUIRED");

    const verify = await call("post", "/api/v1/auth/hr/totp/verify").send({ email: emails.flow, code: "123456" });
    expect(verify.status).toBe(403);
  });

  it("rejects an invalid or tampered enrollment token", async () => {
    const res = await call("post", "/api/v1/auth/hr/enrollment/start").send({ token: "not-a-real-enrollment-token-123" });
    expect(res.status).toBe(401);
  });

  it("performs first-time enrollment and activates TOTP", async () => {
    const start = await call("post", "/api/v1/auth/hr/enrollment/start").send({ token: flowEnrollmentToken });
    expect(start.status).toBe(200);
    expect(start.body.data.email).toBe(emails.flow);
    expect(start.body.data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(start.body.data.uri).toContain("otpauth://totp/");
    expect(start.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    flowSecret = start.body.data.secret;

    const verify = await call("post", "/api/v1/auth/hr/enrollment/verify")
      .send({ token: flowEnrollmentToken, code: await codeFor(flowSecret) });
    expect(verify.status).toBe(200);
    expect(verify.body.data.user.type).toBe("HR");
    expect(verify.body.data.token).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.flow } });
    expect(user.totpEnabled).toBe(true);
    expect(user.totpEnrollmentPending).toBe(false);
    expect(user.totpEnabledAt).toBeTruthy();

    const reused = await call("post", "/api/v1/auth/hr/enrollment/verify")
      .send({ token: flowEnrollmentToken, code: await codeFor(flowSecret) });
    expect(reused.status).toBe(401);
  });

  it("accepts a valid TOTP code and creates an authenticated session", async () => {
    loginCode = await codeFor(loginSecret, 1);
    const res = await call("post", "/api/v1/auth/hr/totp/verify")
      .send({ email: emails.login, code: loginCode });
    expect(res.status).toBe(200);
    expect(res.body.data.user.roles).toContain("HR_ADMIN");
    expect(res.body.data.user.permissions).toBeInstanceOf(Array);
    loginToken = res.body.data.token;
  });

  it("rejects an invalid TOTP code", async () => {
    const current = await codeFor(loginSecret);
    const wrong = String((Number(current) + 1) % 1_000_000).padStart(6, "0");
    const res = await call("post", "/api/v1/auth/hr/totp/verify").send({ email: emails.login, code: wrong });
    expect(res.status).toBe(401);
  });

  it("rejects an expired code outside the drift window", async () => {
    const res = await call("post", "/api/v1/auth/hr/totp/verify")
      .send({ email: emails.login, code: await codeFor(loginSecret, -2) });
    expect(res.status).toBe(401);
  });

  it("rejects replay of an already accepted code", async () => {
    const res = await call("post", "/api/v1/auth/hr/totp/verify")
      .send({ email: emails.login, code: loginCode });
    expect(res.status).toBe(401);
  });

  it("allows only one of two concurrent requests using the same code", async () => {
    await prisma.user.update({
      where: { id: ids.login },
      data: { totpLastUsedStep: null, failedTotpAttempts: 0, lockedUntil: null },
    });
    const code = await codeFor(loginSecret);
    const results = await Promise.all([
      call("post", "/api/v1/auth/hr/totp/verify").send({ email: emails.login, code }),
      call("post", "/api/v1/auth/hr/totp/verify").send({ email: emails.login, code }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);
    const winner = results.find((r) => r.status === 200)!;
    liveSessionToken = winner.body.data.token;
  });

  it("logout invalidates the session", async () => {
    const before = await call("post", "/api/v1/auth/me").set("Authorization", `Bearer ${loginToken}`);
    expect(before.body.data.user?.id).toBe(ids.login);

    const logout = await call("post", "/api/v1/auth/hr/logout").set("Authorization", `Bearer ${loginToken}`);
    expect(logout.status).toBe(200);

    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: verifyAuthToken(loginToken).sid } });
    expect(session.revokedAt).toBeTruthy();

    const after = await call("post", "/api/v1/auth/me").set("Authorization", `Bearer ${loginToken}`);
    expect(after.body.data.user).toBeNull();
  });

  it("admin TOTP reset revokes sessions and forces re-enrollment", async () => {
    const res = await call("post", `/api/v1/users/${ids.login}/reset-totp`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: verifyAuthToken(liveSessionToken).sid } });
    expect(session.revokedAt).toBeTruthy();

    const sessionCheck = await call("post", "/api/v1/auth/me").set("Authorization", `Bearer ${liveSessionToken}`);
    expect(sessionCheck.body.data.user).toBeNull();

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.login } });
    expect(after.totpEnabled).toBe(false);
    expect(after.totpSecretEncrypted).toBeNull();

    const check = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.login });
    expect(check.body.data.status).toBe("ENROLLMENT_REQUIRED");
  });

  it("deactivation revokes access immediately", async () => {
    const deactivate = await call("post", `/api/v1/users/${ids.login}/deactivate`).set("Authorization", `Bearer ${adminToken}`);
    expect(deactivate.status).toBe(200);
    const check = await call("post", "/api/v1/auth/hr/email-check").send({ email: emails.login });
    expect(check.status).toBe(403);
  });
});
