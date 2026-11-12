import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { logAudit } from "../services/audit.service";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("departments.manage"));

const schema = z.object({ name: z.string().min(2).max(120), description: z.string().optional().nullable(), isActive: z.boolean().optional() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = search ? { name: { contains: search, mode: "insensitive" } } : {};
    const [items, total] = await Promise.all([
      prisma.program.findMany({ where, skip, take, orderBy: { name: "asc" } }),
      prisma.program.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { name, description, isActive = true } = parsed.data;
    const exists = await prisma.program.findUnique({ where: { name } });
    if (exists) throw ApiError.conflict("Program already exists.");
    const item = await prisma.program.create({ data: { name, description, isActive } });
    await logAudit(req, { action: "PROGRAM_CREATE", entityType: "Program", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const item = await prisma.program.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Program not found.");
    const updated = await prisma.program.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description, isActive: parsed.data.isActive } });
    await logAudit(req, { action: "PROGRAM_UPDATE", entityType: "Program", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.program.findUnique({ where: { id }, include: { _count: { select: { jobOpenings: true } } } });
    if (!item) throw ApiError.notFound("Program not found.");
    if (item._count.jobOpenings > 0) await prisma.program.update({ where: { id }, data: { isActive: false } });
    else await prisma.program.delete({ where: { id } });
    await logAudit(req, { action: "PROGRAM_DELETE", entityType: "Program", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: item._count.jobOpenings > 0 ? "Program has openings; deactivated." : "Deleted." });
  }),
);

export default router;
