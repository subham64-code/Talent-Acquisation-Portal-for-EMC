import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { verifyAuthToken } from "../utils/jwt";
import { getCachedAuth, setCachedAuth } from "../lib/authCache";
import type { AuthContext } from "../types/express";

const SUPER_CONTROLLER_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];

/**
 * Applies the user's per-user overrides (grant/revoke) to the role-derived
 * permission set. SUPER_ADMIN and IT_ADMIN always keep full access.
 */
function applyOverrides(roles: string[], base: string[], overrides: Array<{ effect: string; permission: { key: string } }>): string[] {
  const baseSet = new Set(base);
  if (roles.some((r) => SUPER_CONTROLLER_ROLES.includes(r))) {
    return Array.from(baseSet);
  }
  for (const o of overrides) {
    if (o.effect === "GRANT") baseSet.add(o.permission.key);
    else if (o.effect === "REVOKE") baseSet.delete(o.permission.key);
  }
  return Array.from(baseSet);
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const cookieToken = req.cookies?.emc_session;
  if (typeof cookieToken === "string" && cookieToken) return cookieToken;
  return null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAuthToken(token);

    const cachedContext = getCachedAuth(payload.sid);
    if (cachedContext) {
      req.auth = cachedContext;
      return next();
    }

    let context: AuthContext;

    if (payload.type === "HR") {
      const [session, user, overrides] = await Promise.all([
        prisma.authSession.findUnique({ where: { id: payload.sid } }),
        prisma.user.findUnique({
          where: { id: payload.sub },
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
            departments: true,
          },
        }),
        prisma.userPermissionOverride.findMany({
          where: { userId: payload.sub },
          include: { permission: { select: { key: true } } },
        }),
      ]);
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() < Date.now() ||
        session.subjectType !== payload.type ||
        session.subjectId !== payload.sub
      ) {
        throw ApiError.unauthorized("Your session has expired. Please sign in again.");
      }
      if (!user || !user.isActive) throw ApiError.unauthorized("Your account is inactive.");

      const roles = user.roles.map((r) => r.role.key);
      const permissions = applyOverrides(
        roles,
        user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
        overrides,
      );
      context = {
        subjectId: user.id,
        type: "HR",
        sessionId: session.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        roles,
        permissions,
        departments: user.departments.map((d) => d.departmentId),
      };
    } else {
      const [session, candidate] = await Promise.all([
        prisma.authSession.findUnique({ where: { id: payload.sid } }),
        prisma.candidate.findUnique({ where: { id: payload.sub } }),
      ]);
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() < Date.now() ||
        session.subjectType !== payload.type ||
        session.subjectId !== payload.sub
      ) {
        throw ApiError.unauthorized("Your session has expired. Please sign in again.");
      }
      if (!candidate) throw ApiError.unauthorized("Candidate account not found.");
      context = {
        subjectId: candidate.id,
        type: "CANDIDATE",
        sessionId: session.id,
        candidateId: candidate.id,
        email: candidate.email,
        name: candidate.fullName,
        roles: ["CANDIDATE"],
        permissions: [],
        departments: [],
      };
    }

    req.auth = context;
    setCachedAuth(context.sessionId, context);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Like `authenticate`, but never rejects: if no valid session is presented the
 * request proceeds with req.auth undefined. Used for endpoints that also accept
 * short-lived purpose tokens (e.g. file access links).
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyAuthToken(token);
    const cachedContext = getCachedAuth(payload.sid);
    if (cachedContext) {
      req.auth = cachedContext;
      return next();
    }
    const session = await prisma.authSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || session.subjectType !== payload.type || session.subjectId !== payload.sub) {
      return next();
    }
    if (payload.type === "HR") {
      const [user, ov] = await Promise.all([
        prisma.user.findUnique({
          where: { id: payload.sub },
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
            departments: true,
          },
        }),
        prisma.userPermissionOverride.findMany({
          where: { userId: payload.sub },
          include: { permission: { select: { key: true } } },
        }),
      ]);
      if (user?.isActive) {
        const roles = user.roles.map((r) => r.role.key);
        const permissions = applyOverrides(
          roles,
          user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
          ov,
        );
        req.auth = {
          subjectId: user.id, type: "HR", sessionId: session.id, userId: user.id,
          email: user.email, name: user.name, roles, permissions,
          departments: user.departments.map((d) => d.departmentId),
        };
        setCachedAuth(session.id, req.auth);
      }
    } else {
      const candidate = await prisma.candidate.findUnique({ where: { id: payload.sub } });
      if (candidate) {
        req.auth = {
          subjectId: candidate.id, type: "CANDIDATE", sessionId: session.id, candidateId: candidate.id,
          email: candidate.email, name: candidate.fullName, roles: ["CANDIDATE"], permissions: [], departments: [],
        };
        setCachedAuth(session.id, req.auth);
      }
    }
    next();
  } catch {
    next();
  }
}

export function requireAuth(...types: Array<"HR" | "CANDIDATE">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (types.length && !types.includes(req.auth.type)) {
      return next(ApiError.forbidden("This area is not available for your account type."));
    }
    next();
  };
}

export function requireHr(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.type !== "HR") return next(ApiError.forbidden("HR access required."));
  next();
}

export function requireCandidate(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.type !== "CANDIDATE") return next(ApiError.forbidden("Candidate access required."));
  next();
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(ApiError.unauthorized());
    if (auth.type !== "HR") return next(ApiError.forbidden("HR access required."));
    if (auth.roles.includes("SUPER_ADMIN")) return next();
    const allowed = permissions.some((p) => auth.permissions.includes(p));
    if (!allowed) {
      return next(ApiError.forbidden("You do not have permission to perform this action."));
    }
    next();
  };
}

/**
 * Returns the department ids an HR user is restricted to, or null when the user
 * can access every department.
 */
export function departmentScope(auth: AuthContext | undefined): string[] | null {
  if (!auth || auth.type !== "HR") return [];
  if (auth.roles.some((r) => ["SUPER_ADMIN", "HR_ADMIN", "HR_RECRUITER"].includes(r))) {
    return null;
  }
  return auth.departments;
}
