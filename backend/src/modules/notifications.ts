import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth } from "../middleware/auth";

const router = express.Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const unreadOnly = req.query.unread === "true";
    const where: any = {};
    if (req.auth!.type === "HR") {
      where.recipientUserId = req.auth!.userId;
    } else {
      where.recipientCandidateId = req.auth!.candidateId;
    }
    if (unreadOnly) where.isRead = false;
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { recipientUser: true, recipientCandidate: true } }),
      prisma.notification.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const where: any = { isRead: false };
    if (req.auth!.type === "HR") where.recipientUserId = req.auth!.userId;
    else where.recipientCandidateId = req.auth!.candidateId;
    const count = await prisma.notification.count({ where });
    return ok(res, { count });
  }),
);

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const where: any = { id };
    if (req.auth!.type === "HR") where.recipientUserId = req.auth!.userId;
    else where.recipientCandidateId = req.auth!.candidateId;
    await prisma.notification.updateMany({ where, data: { isRead: true, readAt: new Date() } });
    return ok(res, { message: "Marked as read." });
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const where: any = { isRead: false };
    if (req.auth!.type === "HR") where.recipientUserId = req.auth!.userId;
    else where.recipientCandidateId = req.auth!.candidateId;
    await prisma.notification.updateMany({ where, data: { isRead: true, readAt: new Date() } });
    return ok(res, { message: "All notifications marked as read." });
  }),
);

export default router;
