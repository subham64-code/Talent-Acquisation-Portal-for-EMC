import { prisma } from "../lib/prisma";

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  excludeUserId?: string;
}

export async function notifyHrTeam(input: NotifyInput): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}) },
      select: { id: true },
    });
    if (!users.length) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({
        recipientUserId: u.id,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      })),
    });
  } catch (error) {
    console.error("[notification] failed to notify HR team", error);
  }
}

export async function notifyUser(userId: string, input: Omit<NotifyInput, "excludeUserId">): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        recipientUserId: userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  } catch (error) {
    console.error("[notification] failed to notify user", error);
  }
}

export async function notifyCandidate(
  candidateId: string,
  input: Omit<NotifyInput, "excludeUserId">,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        recipientCandidateId: candidateId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  } catch (error) {
    console.error("[notification] failed to notify candidate", error);
  }
}
