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

const schema = z.object({ name: z.string().min(2).max(60), isActive: z.boolean().optional() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = search ? { name: { contains: search, mode: "insensitive" } } : {};
    const [items, total] = await Promise.all([
      prisma.employmentType.findMany({ where, skip, take, orderBy: { name: "asc" } }),
      prisma.employmentType.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { name, isActive = true } = parsed.data;
    const exists = await prisma.employmentType.findUnique({ where: { name } });
    if (exists) throw ApiError.conflict("Employment type already exists.");
    const item = await prisma.employmentType.create({ data: { name, isActive } });
    await logAudit(req, { action: "EMPLOYMENT_TYPE_CREATE", entityType: "EmploymentType", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const item = await prisma.employmentType.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Employment type not found.");
    const updated = await prisma.employmentType.update({ where: { id }, data: { name: parsed.data.name, isActive: parsed.data.isActive } });
    await logAudit(req, { action: "EMPLOYMENT_TYPE_UPDATE", entityType: "EmploymentType", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.employmentType.findUnique({ where: { id }, include: { _count: { select: { employees: true, jobOpenings: true, offers: true } } } });
    if (!item) throw ApiError.notFound("Employment type not found.");
    const used = item._count.employees + item._count.jobOpenings + item._count.offers;
    if (used > 0) await prisma.employmentType.update({ where: { id }, data: { isActive: false } });
    else await prisma.employmentType.delete({ where: { id } });
    await logAudit(req, { action: "EMPLOYMENT_TYPE_DELETE", entityType: "EmploymentType", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: used > 0 ? "In use; deactivated." : "Deleted." });
  }),
);

export default router;
