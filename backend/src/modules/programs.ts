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
router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("openings.manage", "departments.manage"));

const schema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = req.query.all === "true" ? {} : { isActive: true };
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (typeof req.query.departmentId === "string" && req.query.departmentId) {
      where.OR = [{ departmentId: req.query.departmentId }, { departmentId: null }];
    }
    if (typeof req.query.departmentOnly === "string" && req.query.departmentOnly && typeof req.query.departmentId === "string") {
      where.OR = [{ departmentId: req.query.departmentId }];
    }
    const [items, total] = await Promise.all([
      prisma.program.findMany({ where, skip, take, orderBy: [{ name: "asc" }], include: { department: true } }),
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
    const { name, description, departmentId, isActive = true } = parsed.data;
    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) throw ApiError.badRequest("Department not found.");
    }
    const exists = await prisma.program.findUnique({ where: { name }, include: { department: true } });
    if (exists) {
      if (!exists.departmentId || !departmentId || exists.departmentId === departmentId) {
        if (exists.departmentId !== departmentId) {
          await prisma.program.update({ where: { id: exists.id }, data: { departmentId: departmentId ?? exists.departmentId } });
          exists.departmentId = departmentId ?? exists.departmentId;
        }
        return ok(res, { item: exists, reused: true });
      }
      throw ApiError.conflict("That program name is already linked to another department.");
    }
    const item = await prisma.program.create({ data: { name, description, departmentId: departmentId ?? null, isActive }, include: { department: true } });
    await logAudit(req, { action: "PROGRAM_CREATE", entityType: "Program", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { departmentId: departmentId ?? null } });
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
    if (parsed.data.departmentId) {
      const department = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
      if (!department) throw ApiError.badRequest("Department not found.");
    }
    const updated = await prisma.program.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description, departmentId: parsed.data.departmentId ?? null, isActive: parsed.data.isActive },
      include: { department: true },
    });
    await logAudit(req, { action: "PROGRAM_UPDATE", entityType: "Program", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { departmentId: parsed.data.departmentId ?? null } });
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
