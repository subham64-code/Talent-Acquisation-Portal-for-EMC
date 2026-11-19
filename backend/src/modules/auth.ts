import express from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created } from "../utils/http";
import { effectivePermissions } from "../lib/permissions";
import { generateOtp, hashSecret, randomToken, verifySecret, verifyPassword, sha256, contentDispositionFilename } from "../utils/crypto";
import { signAuthToken, verifyAuthToken } from "../utils/jwt";
import { authenticate, optionalAuthenticate, requireAuth, requireHr, requirePermission, departmentScope } from "../middleware/auth";
import { clearAuthCache, invalidateAuthSessions } from "../lib/authCache";
import { logAudit } from "../services/audit.service";
import { notifyUser } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { storeFile, readStoredFile, STORAGE_BUCKETS } from "../storage/index";
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
  return d.getTime() < Date.now();
}

function employeeLinkAvailable(invitation: { expiresAt?: Date | null }) {
  return !invitation.expiresAt || invitation.expiresAt.getTime() > Date.now();
}

async function findEmployeeInvitationByToken(token: string) {
  const bySha = await prisma.employeeUpdateInvitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (bySha) return bySha;
  const candidates = await prisma.employeeUpdateInvitation.findMany({ where: { usedAt: null }, take: 1000 });
  for (const invitation of candidates) {
    if (invitation.tokenHash.includes(":") && verifySecret(token, invitation.tokenHash)) {
      await prisma.employeeUpdateInvitation.update({ where: { id: invitation.id }, data: { tokenHash: sha256(token) } }).catch(() => invitation);
      return invitation;
    }
  }
  return null;
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
    if (!user || !user.isActive || !user.roles.some((r) => ["SUPER_ADMIN", "IT_ADMIN", "HR_ADMIN", "HR_RECRUITER"].includes(r.role.key))) {
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

    const [, user, overrides] = await Promise.all([
      prisma.otpVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      prisma.user.findUnique({
        where: { email },
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          departments: true,
        },
      }),
      prisma.userPermissionOverride.findMany({ where: { user: { email } }, include: { permission: { select: { key: true } } } }),
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
    const permissions = effectivePermissions(roles, user.roles, overrides);
    return ok(res, {
      token,
      user: { id: user.id, email: user.email, name: user.name, type: "HR" as const, roles, permissions, departments: user.departments.map((d) => d.departmentId) },
    });
  }),
);

/**
 * Password based sign-in. Reserved strictly for IT administrators as a
 * break-glass option when email delivery is blocked. Every HR role
 * (Main Controller, HR Admin, Sub HR) always signs in with an email OTP.
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
  if (!user.roles.some((r) => r.role.key === "IT_ADMIN")) {
    throw ApiError.unauthorized("Password sign-in is not available for this account. Use the one-time code sent to your email.");
  }
  if (!user.passwordHash) throw ApiError.unauthorized("Password sign-in is not enabled for this account.");
  if (!verifyPassword(password, user.passwordHash)) {
    await logAudit(req, { action: "LOGIN_PASSWORD_FAILED", entityType: "User", entityId: user.id, actorEmail: email });
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId: user.id }, include: { permission: { select: { key: true } } } });

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
  const permissions = effectivePermissions(roles, user.roles, overrides);
  return ok(res, {
    token,
    user: { id: user.id, email: user.email, name: user.name, type: "HR" as const, roles, permissions, departments: user.departments.map((d) => d.departmentId) },
  });
}));

/** Reports whether password sign-in is available for an email (IT administrators only). Used by the login screen. */
router.post("/auth/password/available", authRateLimiter, asyncHandler(async (req, res) => {
  const parsed = emailSchema.safeParse(req.body.email);
  if (!parsed.success) return ok(res, { available: false });
  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { passwordHash: true, isActive: true, roles: { select: { role: { select: { key: true } } } } },
  });
  const isItAdmin = user?.roles.some((r) => r.role.key === "IT_ADMIN") ?? false;
  return ok(res, { available: Boolean(user?.passwordHash && user?.isActive && isItAdmin) });
}));

router.post("/auth/me", optionalAuthenticate, asyncHandler(async (req, res) => {
  const auth = req.auth;
  if (!auth) return ok(res, { user: null });
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
    if (existing) {
      throw ApiError.conflict("An active update invitation already exists for this employee.");
    }

    const token = randomToken();
    const expiresAt: Date | null = null;
    const invitation = await prisma.employeeUpdateInvitation.create({
      data: { employeeId, tokenHash: sha256(token), expiresAt, createdById: req.auth!.subjectId },
    });

    const link = `${env.appUrl}/employee/update?token=${token}`;
    void sendTemplateEmail({
      to: employee.officialEmail,
      templateKey: "employee_update_invitation",
      data: { name: employee.fullName, employeeCode: employee.employeeCode, email: employee.officialEmail, link, expiresAt: null },
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
    const invitation = await findEmployeeInvitationByToken(token);
    if (!invitation || !employeeLinkAvailable(invitation)) throw ApiError.notFound("Invalid or expired invitation link.");
    if (!invitation.openedAt) {
      await prisma.employeeUpdateInvitation.update({
        where: { id: invitation.id },
        data: { openedAt: new Date(), status: invitation.draftUpdatedAt ? "DRAFT" : "OPENED" },
      });
      invitation.openedAt = new Date();
    }
      const employee = await prisma.employee.findUnique({ where: { id: invitation.employeeId } });
      if (!employee) throw ApiError.notFound("Employee record not found.");
      const draft = (invitation.draft ?? null) as Record<string, unknown> | null;
      const submittedFields = ((invitation.submission as { fields?: Record<string, unknown> } | null)?.fields ?? null);
      const submission = invitation.submission as { fileId?: string } | null;
      const saved = draft ?? submittedFields;
      let cv: { fileId: string; fileName: string; size: number } | null = null;
      if (submission?.fileId) {
        const file = await prisma.storedFile.findUnique({ where: { id: submission.fileId } });
        if (file) cv = { fileId: file.id, fileName: file.originalName, size: file.size };
      }
      return ok(res, {
        employee: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName, officialEmail: employee.officialEmail, mobile: employee.mobile, designationId: employee.designationId, departmentId: employee.departmentId, qualification: employee.qualification, graduationYear: employee.graduationYear, personalEmail: employee.personalEmail, totalExperience: employee.totalExperience, relevantExperience: employee.relevantExperience, previousOrganization: employee.previousOrganization, specialization: employee.specialization, employmentTypeId: employee.employmentTypeId, joiningDate: employee.joiningDate, workLocation: employee.workLocation, additionalInfo: employee.additionalInfo },
        draft: saved,
        source: draft ? "draft" : submittedFields ? "submission" : null,
        cv,
        status: invitation.status,
        rejection: invitation.submissionRejection ?? null,
        fieldReview: (invitation.submission as { fieldReview?: Array<{ key?: string; label: string; note?: string }> } | null)?.fieldReview ?? null,
      });
  }),
);

// Draft autosave for the employee self-service form
const draftFields = z.object({
  fullName: z.string().optional(),
  officialEmail: z.string().optional(),
  personalEmail: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  designationId: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  graduationYear: z.coerce.number().optional().nullable(),
  totalExperience: z.coerce.number().optional().nullable(),
  relevantExperience: z.coerce.number().optional().nullable(),
  previousOrganization: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  employmentTypeId: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),
});

router.get(
  "/auth/employee/invitation/:token/draft",
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invitation = await findEmployeeInvitationByToken(token);
    if (!invitation || !employeeLinkAvailable(invitation)) throw ApiError.notFound("Invalid or expired invitation link.");
    return ok(res, { draft: invitation.draft ?? null, draftUpdatedAt: invitation.draftUpdatedAt });
  }),
);

router.put(
  "/auth/employee/invitation/:token/draft",
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invitation = await findEmployeeInvitationByToken(token);
    if (!invitation || !employeeLinkAvailable(invitation)) throw ApiError.notFound("Invalid or expired invitation link.");
    const fields = draftFields.safeParse(req.body ?? {});
    if (!fields.success) throw ApiError.badRequest("Invalid draft data.", fields.error.flatten());
    await prisma.employeeUpdateInvitation.update({
      where: { id: invitation.id },
      data: { draft: fields.data, draftUpdatedAt: new Date(), status: "DRAFT" },
    });
    return ok(res, { message: "Draft saved.", savedAt: new Date().toISOString() });
  }),
);

  router.get(
    "/auth/employee/invitation/:token/cv",
    asyncHandler(async (req, res) => {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
      const invitation = await findEmployeeInvitationByToken(token);
      if (!invitation || !employeeLinkAvailable(invitation)) throw ApiError.notFound("Invalid or expired invitation link.");
      const submission = invitation.submission as { fileId?: string } | null;
      const fileId = submission?.fileId;
      if (!fileId) throw ApiError.notFound("No CV has been uploaded with this invitation yet.");
      const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
      if (!file || file.ownerType !== "EMPLOYEE" || file.ownerId !== invitation.employeeId) throw ApiError.forbidden("This CV is not linked to the invitation.");
      const buffer = await readStoredFile(file);
      const inline = /^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.mimeType);
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", contentDispositionFilename(file.originalName, inline ? "inline" : "attachment"));
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "private, no-store");
      return res.send(buffer);
    }),
  );

  const employeeUpdateFields = z.object({
  fullName: z.string().min(2),
  officialEmail: z.string().email(),
  personalEmail: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number (starting 6–9)."),
  designationId: z.string().min(1),
  departmentId: z.string().min(1),
  qualification: z.string().min(2),
  graduationYear: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 6),
  totalExperience: z.coerce.number().nonnegative(),
  relevantExperience: z.coerce.number().nonnegative(),
  previousOrganization: z.string().min(1),
  specialization: z.string().min(1),
  employmentTypeId: z.string().min(1),
  joiningDate: z.coerce.date().refine((value) => value.getTime() <= Date.now(), "Joining date cannot be in the future."),
  workLocation: z.string().min(1),
  additionalInfo: z.string().min(1),
});

router.post(
  "/auth/employee/invitation/:token/submit",
  upload.single("cv"),
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const invitation = await findEmployeeInvitationByToken(token);
    if (!invitation || !employeeLinkAvailable(invitation)) throw ApiError.notFound("Invalid, used, or expired invitation link.");

    const employee = await prisma.employee.findUnique({ where: { id: invitation.employeeId } });
    if (!employee) throw ApiError.notFound("Employee record not found.");
    const existingSubmission = invitation.submission as { fileId?: string } | null;
    const existingFileId = existingSubmission?.fileId;
    if (!req.file && !existingFileId) throw ApiError.badRequest("Please upload your latest CV.");

    const fields = employeeUpdateFields.parse(req.body);

    let fileId = existingFileId;
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
      fileId = file.id;
    }

    await prisma.employeeUpdateInvitation.update({
      where: { id: invitation.id },
      data: {
        usedAt: new Date(),
        status: "SUBMITTED",
        submissionStatus: "PENDING",
        draft: Prisma.DbNull,
        draftUpdatedAt: null,
        submission: { fields, ...(fileId ? { fileId } : {}), submittedAt: new Date().toISOString() },
      },
    });

    void sendTemplateEmail({
      to: employee.officialEmail,
      templateKey: "employee_update_confirmation",
      data: { name: employee.fullName, employeeCode: employee.employeeCode },
      metadata: { employeeId: employee.id, invitationId: invitation.id },
    });

    await logAudit(req, { action: "EMPLOYEE_UPDATE_SUBMIT", entityType: "EmployeeUpdateInvitation", entityId: invitation.id, actorId: employee.id, actorEmail: employee.officialEmail, metadata: { invitationId: invitation.id, employeeId: employee.id } });

    return ok(res, { message: "Your information has been submitted successfully. Our HR team will verify it before the employee record is updated.", employeeId: employee.id });
  }),
);

export default router;
