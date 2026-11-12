import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created } from "../utils/http";
import { generateOtp, hashSecret, randomToken, verifySecret, verifyPassword } from "../utils/crypto";
import { signAuthToken, verifyAuthToken } from "../utils/jwt";
import { authenticate, requireAuth, requireHr, requirePermission, departmentScope } from "../middleware/auth";
import { clearAuthCache, invalidateAuthSessions } from "../lib/authCache";
import { logAudit } from "../services/audit.service";
import { notifyUser } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { storeFile, STORAGE_BUCKETS } from "../storage/index";
import { upload } from "../middleware/upload";
import { authRateLimiter } from "../middleware/rateLimit";
import { env } from "../config/env";
import type { ApplicationStatus } from "../config/constants";

const router = express.Router();

const emailSchema = z.string().email().trim().toLowerCase();
const otpCodeSchema = z.string().length(6).regex(/^\d+$/);

function setSessionCookie(res: express.Response, token: string) {
  res.cookie("emc_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie("emc_session", { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
}

function isExpired(d: Date) {
  return d.getTime() <= Date.now();
}

// How many concurrent sessions a user may hold. Oldest beyond the cap are
// revoked; active tabs are never kicked out by a routine re-login.
const MAX_SESSIONS_PER_USER = 10;

async function createSession(subjectType: "HR" | "CANDIDATE", subjectId: string, req: express.Request) {
  // Read every live session, newest last, so we can trim oldest beyond the cap.
  const existing = await prisma.authSession.findMany({
    where: { subjectType, subjectId, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const overflow = Math.max(0, existing.length - (MAX_SESSIONS_PER_USER - 1));
  const revokeIds = overflow > 0 ? existing.slice(0, overflow).map((s) => s.id) : [];

  const [session] = await Promise.all([
    prisma.authSession.create({
      data: {
        id: randomToken(),
        subjectType,
        subjectId,
        userId: subjectType === "HR" ? subjectId : undefined,
        candidateId: subjectType === "CANDIDATE" ? subjectId : undefined,
        expiresAt: new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000),
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      },
    }),
    ...revokeIds.map((sid) => prisma.authSession.update({ where: { id: sid }, data: { revokedAt: new Date() } })),
  ]);
  if (revokeIds.length) invalidateAuthSessions(revokeIds);
  return session;
}

router.post("/auth/hr/otp/request",
  asyncHandler(async (req, res) => {
    const parsed = emailSchema.safeParse(req.body.email);
    if (!parsed.success) throw ApiError.badRequest("A valid email address is required.");
    const email = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
    if (!user || !user.isActive || !user.roles.some((r) => r.role.key === "HR_ADMIN" || r.role.key === "SUPER_ADMIN")) {
      throw ApiError.forbidden("This email is not authorized for HR access.");
    }

    // A fresh OTP supersedes any earlier one — invalidate first, then create.
    // (These must stay sequential; running them concurrently lets updateMany
    // consume the OTP created in the same request.)
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);
    await prisma.otpVerification.updateMany({
      where: { email, purpose: "HR_LOGIN", consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await prisma.otpVerification.create({
      data: { email, purpose: "HR_LOGIN", codeHash: hashSecret(code), expiresAt, attempts: 0, maxAttempts: env.otpMaxAttempts, ip: req.ip },
    });

    void sendTemplateEmail({
      to: email,
      templateKey: "hr_otp",
      data: { name: user.name, code, expiresIn: env.otpTtlMinutes + " minutes" },
      metadata: { purpose: "HR_LOGIN" },
    });

    return ok(res, { message: "OTP sent to your email.", expiresIn: env.otpTtlMinutes * 60 });
  }),
);

router.post("/auth/hr/otp/verify",
  asyncHandler(async (req, res) => {
    const body = z.object({ email: emailSchema, code: otpCodeSchema }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("Email and 6-digit OTP code are required.");
    const { email, code } = body.data;

    const record = await prisma.otpVerification.findFirst({
      where: { email, purpose: "HR_LOGIN", consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw ApiError.notFound("No pending OTP request found for this email.");
    if (record.attempts >= record.maxAttempts) {
      throw ApiError.tooMany("Too many OTP attempts. Please request a new OTP.");
    }
    if (isExpired(record.expiresAt)) throw ApiError.badRequest("The OTP has expired. Please request a new one.");

    if (!verifySecret(code, record.codeHash)) {
      await prisma.otpVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw ApiError.unauthorized("Invalid OTP code. Please try again.");
    }

    const [, user] = await Promise.all([
      prisma.otpVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      prisma.user.findUnique({
        where: { email },
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          departments: true,
        },
      }),
    ]);
    if (!user || !user.isActive) throw ApiError.forbidden("Your account is not active.");

    const session = await createSession("HR", user.id, req);
    const token = signAuthToken({ sub: user.id, type: "HR", sid: session.id });
    await Promise.allSettled([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      logAudit(req, {
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { provider: "email-otp" },
      }),
      notifyUser(user.id, { type: "auth.login", title: "HR portal sign-in", body: "You signed in to the HR portal." }),
    ]);

    setSessionCookie(res, token);
    const roles = user.roles.map((r) => r.role.key);
    const permissions = Array.from(new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))));
    return ok(res, {
      token,
      user: { id: user.id, email: user.email, name: user.name, type: "HR" as const, roles, permissions, departments: user.departments.map((d) => d.departmentId) },
    });
  }),
);

/**
 * Password based sign-in. Reserved for accounts that have a password configured
 * (IT administrators), so they can recover access if the HR email flow is blocked.
 */
router.post("/auth/password/login", authRateLimiter, asyncHandler(async (req, res) => {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Email and password are required.");
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, departments: true },
  });
  if (!user || !user.isActive) throw ApiError.unauthorized("Invalid email or password.");
  if (!user.passwordHash) throw ApiError.unauthorized("Password sign-in is not enabled for this account.");
  if (!verifyPassword(password, user.passwordHash)) {
    await logAudit(req, { action: "LOGIN_PASSWORD_FAILED", entityType: "User", entityId: user.id, actorEmail: email });
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const session = await createSession("HR", user.id, req);
  const token = signAuthToken({ sub: user.id, type: "HR", sid: session.id });
  await Promise.allSettled([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    logAudit(req, {
      action: "LOGIN_PASSWORD",
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { provider: "password" },
    }),
  ]);

  setSessionCookie(res, token);
  const roles = user.roles.map((r) => r.role.key);
  const permissions = Array.from(new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))));
  return ok(res, {
    token,
    user: { id: user.id, email: user.email, name: user.name, type: "HR" as const, roles, permissions, departments: user.departments.map((d) => d.departmentId) },
  });
}));

/** Reports whether password sign-in is available for an email (used by the login screen). */
router.post("/auth/password/available", authRateLimiter, asyncHandler(async (req, res) => {
  const parsed = emailSchema.safeParse(req.body.email);
  if (!parsed.success) return ok(res, { available: false });
  const user = await prisma.user.findUnique({ where: { email: parsed.data }, select: { passwordHash: true, isActive: true } });
  return ok(res, { available: Boolean(user?.passwordHash && user?.isActive) });
}));

router.post("/auth/me", authenticate, asyncHandler(async (req, res) => {
  const auth = req.auth!;
  return ok(res, {
    user: {
      id: auth.subjectId,
      email: auth.email,
      name: auth.name,
      type: auth.type,
      roles: auth.roles,
      permissions: auth.permissions,
      departments: auth.departments,
    },
  });
}));

router.post("/auth/logout", authenticate, asyncHandler(async (req, res) => {
  if (req.auth) {
    await prisma.authSession.updateMany({ where: { id: req.auth.sessionId }, data: { revokedAt: new Date() } });
    clearAuthCache();
    await logAudit(req, { action: "LOGOUT", entityType: "AuthSession", entityId: req.auth.sessionId, actorId: req.auth.subjectId, actorEmail: req.auth.email });
  }
  clearSessionCookie(res);
  return ok(res, { message: "Signed out." });
}));


// ---------- Employee update invitation ----------
const inviteSchema = z.object({ employeeId: z.string().min(1) });

router.post(
  "/employee-invitations",
  authenticate,
  requireAuth("HR"),
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("employeeId is required.");
    const { employeeId } = parsed.data;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw ApiError.notFound("Employee not found.");

    const existing = await prisma.employeeUpdateInvitation.findFirst({
      where: { employeeId, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      throw ApiError.conflict("An active update invitation already exists for this employee.");
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + env.employeeInviteTtlHours * 60 * 60 * 1000);
    const invitation = await prisma.employeeUpdateInvitation.create({
      data: { employeeId, tokenHash: hashSecret(token), expiresAt, createdById: req.auth!.subjectId },
    });

    const link = `${env.appUrl}/employee/update?token=${token}`;
    void sendTemplateEmail({
      to: employee.officialEmail,
      templateKey: "employee_update_invitation",
      data: { name: employee.fullName, employeeCode: employee.employeeCode, email: employee.officialEmail, link, expiresAt: expiresAt.toISOString() },
      metadata: { invitationId: invitation.id, employeeId },
    });

    await logAudit(req, { action: "EMPLOYEE_INVITE_SEND", entityType: "EmployeeUpdateInvitation", entityId: invitation.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });

    return created(res, { invitationId: invitation.id, message: "Update invitation sent to " + employee.officialEmail });
  }),
);

router.get(
  "/auth/employee/invitation/:token",
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invitation = await prisma.employeeUpdateInvitation.findUnique({ where: { tokenHash: hashSecret(token) } });
    if (!invitation || invitation.usedAt || isExpired(invitation.expiresAt)) throw ApiError.notFound("Invalid or expired invitation link.");
    const employee = await prisma.employee.findUnique({ where: { id: invitation.employeeId } });
    if (!employee) throw ApiError.notFound("Employee record not found.");
    return ok(res, { employee: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName, officialEmail: employee.officialEmail, mobile: employee.mobile, designation: employee.designationId, department: employee.departmentId, qualification: employee.qualification, graduationYear: employee.graduationYear } });
  }),
);

const employeeUpdateFields = z.object({
  fullName: z.string().min(2),
  officialEmail: z.string().email().optional(),
  personalEmail: z.string().email().optional().nullable(),
  mobile: z.string().optional().nullable(),
  designationId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  graduationYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  totalExperience: z.coerce.number().nonnegative().optional().nullable(),
  relevantExperience: z.coerce.number().nonnegative().optional().nullable(),
  previousOrganization: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  employmentTypeId: z.string().optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),
});

router.post(
  "/auth/employee/invitation/:token/submit",
  upload.single("cv"),
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invitation = await prisma.employeeUpdateInvitation.findUnique({ where: { tokenHash: hashSecret(token) } });
    if (!invitation || invitation.usedAt || isExpired(invitation.expiresAt)) throw ApiError.notFound("Invalid, used, or expired invitation link.");

    const employee = await prisma.employee.findUnique({ where: { id: invitation.employeeId } });
    if (!employee) throw ApiError.notFound("Employee record not found.");

    const fields = employeeUpdateFields.parse(req.body);

    const updateData: Record<string, unknown> = {};
    const scalarFields: (keyof typeof fields)[] = [
      "fullName","officialEmail","personalEmail","mobile","designationId","departmentId","qualification",
      "previousOrganization","specialization","employmentTypeId","workLocation","additionalInfo","totalExperience","relevantExperience","graduationYear","joiningDate",
    ];
    for (const k of scalarFields) {
      const v = fields[k];
      if (v !== undefined && v !== null && v !== "") updateData[k] = v;
    }

    if (updateData.officialEmail && updateData.officialEmail !== employee.officialEmail) {
      const exists = await prisma.employee.findUnique({ where: { officialEmail: updateData.officialEmail as string } });
      if (exists) throw ApiError.conflict("Official email is already in use by another employee.");
    }

    await prisma.employee.update({ where: { id: employee.id }, data: updateData });

    if (req.file) {
      const file = await storeFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        ownerType: "EMPLOYEE",
        ownerId: employee.id,
        bucket: STORAGE_BUCKETS.EMPLOYEES,
        visibility: "PRIVATE",
      });
      await prisma.cvVersion.create({
        data: { employeeId: employee.id, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD" },
      });
    }

    await prisma.employeeUpdateInvitation.update({ where: { id: invitation.id }, data: { usedAt: new Date(), submission: { fields, submittedAt: new Date().toISOString() } } });

    void sendTemplateEmail({
      to: employee.officialEmail,
      templateKey: "employee_update_confirmation",
      data: { name: employee.fullName, employeeCode: employee.employeeCode },
      metadata: { employeeId: employee.id },
    });

    await logAudit(req, { action: "EMPLOYEE_UPDATE_SUBMIT", entityType: "Employee", entityId: employee.id, actorId: employee.id, actorEmail: employee.officialEmail, metadata: { invitationId: invitation.id } });

    return ok(res, { message: "Your information has been submitted successfully.", employeeId: employee.id });
  }),
);

export default router;
