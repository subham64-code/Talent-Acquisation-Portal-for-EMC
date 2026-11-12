import type { Request } from "express";
import { prisma } from "../lib/prisma";

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  actorType?: string;
  actorId?: string | null;
  actorEmail?: string | null;
}

export async function logAudit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    const auth = req?.auth;
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType ?? auth?.type ?? "SYSTEM",
        actorId: input.actorId ?? auth?.subjectId ?? null,
        actorEmail: input.actorEmail ?? auth?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? undefined) as never,
        ip: req?.ip,
        userAgent: req?.get("user-agent") ?? undefined,
      },
    });
  } catch (error) {
    // Audit logging must never break the primary operation.
    console.error("[audit] failed to write audit log", error);
  }
}
