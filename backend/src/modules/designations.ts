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

const schema = z.object({ name: z.string().min(2).max(100), departmentId: z.string().min(1).optional().nullable(), isActive: z.boolean().optional() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = search ? { name: { contains: search, mode: "insensitive" } } : {};
    if (req.query.departmentId) where.departmentId = String(req.query.departmentId);
    const [items, total] = await Promise.all([
      prisma.designation.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { department: true } }),
      prisma.designation.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { name, departmentId, isActive = true } = parsed.data;
    const exists = await prisma.designation.findFirst({ where: { name, departmentId } });
    if (exists) throw ApiError.conflict("Designation already exists in this department.");
    const item = await prisma.designation.create({ data: { name, departmentId, isActive }, include: { department: true } });
    await logAudit(req, { action: "DESIGNATION_CREATE", entityType: "Designation", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const item = await prisma.designation.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Designation not found.");
    const updated = await prisma.designation.update({ where: { id }, data: { name: parsed.data.name, departmentId: parsed.data.departmentId, isActive: parsed.data.isActive }, include: { department: true } });
    await logAudit(req, { action: "DESIGNATION_UPDATE", entityType: "Designation", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.designation.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
    if (!item) throw ApiError.notFound("Designation not found.");
    if (item._count.employees > 0) await prisma.designation.update({ where: { id }, data: { isActive: false } });
    else await prisma.designation.delete({ where: { id } });
    await logAudit(req, { action: "DESIGNATION_DELETE", entityType: "Designation", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: item._count.employees > 0 ? "Designation has employees; deactivated." : "Deleted." });
  }),
);

export default router;
