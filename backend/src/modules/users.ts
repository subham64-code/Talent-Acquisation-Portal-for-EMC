import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { hashPassword, passwordStrengthError } from "../utils/crypto";
import { storageBucketSummary } from "../storage/index";
import { clearAuthCache } from "../lib/authCache";
import { logAudit } from "../services/audit.service";
import { notifyUser } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { env } from "../config/env";

const router = express.Router();

const roleSchema = z.string().min(1);

// NOTE: This router is mounted at /api/v1, so a router-level HR guard would block
// candidate routes. Every route below applies its own permission check instead.
// Scope the blanket auth check to this router's namespaces so requests for
// other modules (e.g. /files/*) are not intercepted here.
router.use(["/users", "/permissions", "/roles", "/audit-logs", "/active-sessions", "/storage"], authenticate);

router.get(
  "/users",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {
      AND: [
        search
          ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip, take,
        orderBy: { createdAt: "desc" },
        include: {
          roles: { include: { role: true } },
          departments: { include: { department: true } },
          _count: { select: { sessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  roleIds: z.array(roleSchema).min(1, "At least one role is required."),
  departmentIds: z.array(roleSchema).optional(),
});

router.post(
  "/users",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { name, email, roleIds, departmentIds = [] } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw ApiError.conflict("A user with this email already exists.");

    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) throw ApiError.badRequest("One or more roles are invalid.");

    const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } } });
    if (departments.length !== departmentIds.length) throw ApiError.badRequest("One or more departments are invalid.");

    const user = await prisma.user.create({
      data: {
        name, email, isActive: true,
        roles: { create: roleIds.map((id) => ({ roleId: id })) },
        departments: { create: departmentIds.map((id) => ({ departmentId: id })) },
      },
      include: { roles: { include: { role: true } }, departments: true },
    });

    void sendTemplateEmail({
      to: email,
      templateKey: "hr_invitation",
      data: { name, roleName: roles.map((r) => r.name).join(", "), link: `${env.appUrl}/hr/login` },
      metadata: { userId: user.id },
    });
    await notifyUser(user.id, { type: "hr.invitation", title: "HR account invited", body: "You have been invited to the HR portal." });
    await logAudit(req, { action: "USER_CREATE", entityType: "User", entityId: user.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { email } });

    return created(res, { user });
  }),
);

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(roleSchema).optional(),
  departmentIds: z.array(roleSchema).optional(),
});

router.patch(
  "/users/:id",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound("User not found.");
    if (id === req.auth!.subjectId && parsed.data.isActive === false) throw ApiError.badRequest("You cannot deactivate your own account.");

    // Prevent removing the last super admin.
    if (parsed.data.roleIds !== undefined) {
      const currentRoles = await prisma.userRole.findMany({ where: { userId: id }, include: { role: true } });
      const isSuperAdminNow = currentRoles.some((r) => r.role.key === "SUPER_ADMIN");
      const nextSuperAdminRole = await prisma.role.findFirst({ where: { id: { in: parsed.data.roleIds }, key: "SUPER_ADMIN" } });
      const superAdminUserIds = await prisma.userRole.findMany({
        where: { role: { key: "SUPER_ADMIN" } },
        select: { userId: true },
      });
      const isOnlySuperAdmin = isSuperAdminNow && !nextSuperAdminRole && superAdminUserIds.length === 1 && superAdminUserIds[0]?.userId === id;
      if (isOnlySuperAdmin) {
        throw ApiError.badRequest("At least one super admin must remain active.");
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.roleIds !== undefined ? { roles: { deleteMany: {}, create: parsed.data.roleIds.map((rid) => ({ roleId: rid })) } } : {}),
        ...(parsed.data.departmentIds !== undefined ? { departments: { deleteMany: {}, create: parsed.data.departmentIds.map((did) => ({ departmentId: did })) } } : {}),
      },
      include: { roles: { include: { role: true } }, departments: true },
    });
    await logAudit(req, { action: "USER_UPDATE", entityType: "User", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: parsed.data });
    return ok(res, { user: updated });
  }),
);

let rolesById: Record<string, { key: string; name: string }> = {};
router.get(
  "/users/:id",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } }, departments: true, sessions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!user) throw ApiError.notFound("User not found.");
    return ok(res, { user });
  }),
);

router.post(
  "/users/:id/deactivate",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    if (id === req.auth!.subjectId) throw ApiError.badRequest("You cannot deactivate your own account.");
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await prisma.authSession.updateMany({ where: { subjectType: "HR", subjectId: id }, data: { revokedAt: new Date() } });
    clearAuthCache();
    await logAudit(req, { action: "USER_DEACTIVATE", entityType: "User", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "User deactivated and sessions revoked." });
  }),
);

router.post(
  "/users/:id/activate",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    await logAudit(req, { action: "USER_ACTIVATE", entityType: "User", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "User activated." });
  }),
);

router.get(
  "/users/:id/sessions",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const sessions = await prisma.authSession.findMany({
      where: { subjectType: "HR", subjectId: id },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, { sessions });
  }),
);

router.delete(
  "/users/:id/sessions/:sessionId",
  requirePermission("users.manage"),
  asyncHandler(async (req, res) => {
    const { id, sessionId } = z.object({ id: z.string().min(1), sessionId: z.string().min(1) }).parse(req.params);
    await prisma.authSession.updateMany({ where: { id: sessionId, subjectType: "HR", subjectId: id }, data: { revokedAt: new Date() } });
    clearAuthCache();
    await logAudit(req, { action: "SESSION_REVOKE", entityType: "AuthSession", entityId: sessionId, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "Session revoked." });
  }),
);

router.get(
  "/permissions",
  requirePermission("users.manage"),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({ orderBy: { key: "asc" } });
    return ok(res, { permissions });
  }),
);

/**
 * IT administrator / HR controller reset. Revokes every session, invalidates pending
 * OTPs and deactivates the account so it can be re-invited cleanly.
 */
router.post(
  "/:id/reset",
  requirePermission("users.reset"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ reason: z.string().optional().nullable(), deactivate: z.boolean().optional().default(true) }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("Invalid input.", body.error.flatten());
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound("User not found.");
    if (id === req.auth!.subjectId) throw ApiError.badRequest("You cannot reset your own account.");

    await prisma.authSession.updateMany({ where: { subjectType: "HR", subjectId: id }, data: { revokedAt: new Date() } });
    clearAuthCache();
    await prisma.otpVerification.updateMany({ where: { email: user.email, consumedAt: null }, data: { consumedAt: new Date() } });
    if (body.data.deactivate) {
      await prisma.user.update({ where: { id }, data: { isActive: false } });
    }

    await logAudit(req, {
      action: "USER_RESET",
      entityType: "User",
      entityId: id,
      actorId: req.auth!.subjectId,
      actorEmail: req.auth!.email,
      metadata: { reason: body.data.reason, deactivated: body.data.deactivate, targetEmail: user.email },
    });
    await notifyUser(id, {
      type: "account.reset",
      title: "Your HR portal access was reset",
      body: body.data.reason
        ? `Your access was reset by the administrator. Reason: ${body.data.reason}`
        : "Your access was reset by the administrator. Please contact HR to be re-invited.",
    });
    return ok(res, { message: "User reset. All sessions and pending OTPs were revoked." });
  }),
);

/** Restores a previously reset/deactivated user. */
router.post(
  "/:id/restore",
  requirePermission("users.reset"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound("User not found.");
    const updated = await prisma.user.update({ where: { id }, data: { isActive: true } });
    await logAudit(req, { action: "USER_RESTORE", entityType: "User", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { user: updated, message: "User restored." });
  }),
);

/** Sets or clears a password so the IT administrator can use password sign-in. */
router.post(
  "/:id/password",
  requirePermission("users.reset"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = z.object({ password: z.string().optional().nullable() }).safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound("User not found.");

    const password = parsed.data.password;
    if (password) {
      const weak = passwordStrengthError(password);
      if (weak) throw ApiError.badRequest(weak);
      await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    } else {
      await prisma.user.update({ where: { id }, data: { passwordHash: null } });
    }
    await prisma.authSession.updateMany({ where: { subjectType: "HR", subjectId: id }, data: { revokedAt: new Date() } });
    clearAuthCache();
    await logAudit(req, { action: "USER_PASSWORD_SET", entityType: "User", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { enabled: Boolean(password) } });
    return ok(res, { message: password ? "Password enabled for this account." : "Password sign-in disabled for this account." });
  }),
);

router.get(
  "/storage/overview",
  requirePermission("users.reset"),
  asyncHandler(async (_req, res) => {
    const buckets = await storageBucketSummary();
    const totals = buckets.reduce(
      (acc, b) => ({ files: acc.files + b.files, bytes: acc.bytes + b.bytes }),
      { files: 0, bytes: 0 },
    );
    return ok(res, { buckets, totals, provider: process.env.STORAGE_PROVIDER || "local" });
  }),
);

router.get(
  "/roles",
  requirePermission("users.manage"),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ include: { _count: { select: { permissions: true, users: true } } }, orderBy: { key: "asc" } });
    return ok(res, { roles });
  }),
);

/** Audit trail viewer for IT administrators. */
router.get(
  "/audit-logs",
  requirePermission("audit.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req, 20, 100);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action, mode: "insensitive" };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

/** Session control: every active HR session in the system. */
router.get(
  "/active-sessions",
  requirePermission("users.reset"),
  asyncHandler(async (_req, res) => {
    const sessions = await prisma.authSession.findMany({
      where: { subjectType: "HR", revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(res, { sessions });
  }),
);

const CONTROLLER_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];

/** Only the HR Super Admin or IT Admin may view/change per-user access rights. */
function assertAccessController(req: express.Request) {
  const roles = req.auth?.roles ?? [];
  if (!roles.some((r) => CONTROLLER_ROLES.includes(r))) {
    throw ApiError.forbidden("Only the HR Super Admin or IT Admin can change access rights.");
  }
}

function groupModule(key: string): string {
  const prefix = key.split(".")[0] ?? "other";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Detailed permission matrix for one HR user (role baseline + per-user overrides). */
router.get(
  "/users/:id/access",
  asyncHandler(async (req, res) => {
    assertAccessController(req);
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user) throw ApiError.notFound("User not found.");
    const [permissions, overrides] = await Promise.all([
      prisma.permission.findMany({ orderBy: { key: "asc" } }),
      prisma.userPermissionOverride.findMany({ where: { userId: id }, include: { permission: true } }),
    ]);
    const isControllerAccount = user.roles.some((r) => CONTROLLER_ROLES.includes(r.role.key));
    const baseKeys = new Set(
      isControllerAccount
        ? permissions.map((p) => p.key)
        : Array.from(new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))),
    );
    const overrideMap = new Map(overrides.map((o) => [o.permission.key, o.effect]));
    const items = permissions.map((p) => {
      const base = baseKeys.has(p.key);
      const override = overrideMap.get(p.key) ?? null;
      const effective = override === "GRANT" ? true : override === "REVOKE" ? false : base;
      return {
        id: p.id,
        key: p.key,
        description: p.description,
        module: groupModule(p.key),
        base,
        override,
        effective,
      };
    });
    return ok(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        isControllerAccount,
        roles: user.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
      },
      permissions: items,
    });
  }),
);

/** Replaces the per-user overrides (grant/revoke list) for an HR user. */
router.put(
  "/users/:id/access",
  asyncHandler(async (req, res) => {
    assertAccessController(req);
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({ overrides: z.array(z.object({ permissionId: z.string().min(1), effect: z.enum(["GRANT", "REVOKE"]) })) })
      .safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("overrides must be a list of { permissionId, effect: GRANT | REVOKE }.", body.error.flatten());
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
    if (!user) throw ApiError.notFound("User not found.");

    const ids = Array.from(new Set(body.data.overrides.map((o) => o.permissionId)));
    if (ids.length) {
      const found = await prisma.permission.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (found.length !== ids.length) throw ApiError.badRequest("One or more permissions are invalid.");
    }

    await prisma.$transaction([
      prisma.userPermissionOverride.deleteMany({ where: { userId: id } }),
      ...(ids.length
        ? [prisma.userPermissionOverride.createMany({ data: body.data.overrides.map((o) => ({ userId: id, permissionId: o.permissionId, effect: o.effect })) })]
        : []),
    ]);
    clearAuthCache();

    const grants = body.data.overrides.filter((o) => o.effect === "GRANT").length;
    const revocations = body.data.overrides.filter((o) => o.effect === "REVOKE").length;
    await logAudit(req, {
      action: "USER_ACCESS_UPDATE",
      entityType: "User",
      entityId: id,
      actorId: req.auth!.subjectId,
      actorEmail: req.auth!.email,
      metadata: { targetEmail: user.email, grants, revocations },
    });
    void notifyUser(id, {
      type: "access.updated",
      title: "Your portal access was updated",
      body: "The HR Super Admin updated your access rights. Some sections of the portal may have changed for you.",
    });
    return ok(res, { message: "Access rights updated. They take effect immediately on the user's next request.", grants, revocations });
  }),
);

export default router;
