import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { logAudit } from "../services/audit.service";
import { cache } from "../services/cache.service";

const router = express.Router();

router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("departments.manage"));

const deptSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] }
      : {};
    const [items, total] = await Promise.all([
      prisma.department.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { _count: { select: { employees: true, jobOpenings: true } } } }),
      prisma.department.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get("/dropdown", asyncHandler(async (_req, res) => {
  const items = await prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  return ok(res, { items });
}));

const departmentEmployeesSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).max(1000),
  action: z.enum(["assign", "unassign"]).default("assign"),
  reason: z.string().max(240).optional().nullable(),
});

router.post(
  "/:id/employees",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = departmentEmployeesSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Select at least one employee.", parsed.error.flatten());
    const { employeeIds, action, reason } = parsed.data;
    const uniqueIds = [...new Set(employeeIds)];
    if (action === "assign") {
      const target = await prisma.department.findUnique({ where: { id } });
      if (!target) throw ApiError.notFound("Department not found.");
      if (!target.isActive) throw ApiError.badRequest("Employees can only be assigned to an active department.");
    } else {
      const target = await prisma.department.findUnique({ where: { id } });
      if (!target) throw ApiError.notFound("Department not found.");
    }

    const employees = await prisma.employee.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, departmentId: true, fullName: true } });
    const selected = new Set(employees.map((employee) => employee.id));
    const missingIds = uniqueIds.filter((employeeId) => !selected.has(employeeId));
    const working = action === "assign"
      ? employees.filter((employee) => employee.departmentId !== id)
      : employees.filter((employee) => employee.departmentId !== null);
    const workingIds = working.map((employee) => employee.id);

    if (workingIds.length > 0) {
      await prisma.$transaction([
        prisma.employee.updateMany({
          where: { id: { in: workingIds }, ...(action === "unassign" ? { departmentId: id } : {}) },
          data: { departmentId: action === "assign" ? id : null },
        }),
        prisma.employeeDepartmentHistory.createMany({
          data: working.map((employee) => ({
            employeeId: employee.id,
            fromDepartmentId: employee.departmentId,
            toDepartmentId: action === "assign" ? id : null,
            reason: reason || null,
            changedById: req.auth!.subjectId,
          })),
        }),
      ]);
    }

    if (workingIds.length > 0) await cache.peopleChanged();
    await logAudit(req, {
      action: action === "assign" ? "DEPARTMENT_ASSIGN_EMPLOYEES" : "DEPARTMENT_UNASSIGN_EMPLOYEES",
      entityType: "Department",
      entityId: id,
      actorId: req.auth!.subjectId,
      actorEmail: req.auth!.email,
      metadata: { action, employeeIds: workingIds, skippedIds: uniqueIds.filter((employeeId) => !workingIds.includes(employeeId)), missingIds, reason: reason || null },
    });

    return ok(res, { selected: uniqueIds.length, changed: workingIds.length, unchanged: uniqueIds.length - workingIds.length - missingIds.length, missing: missingIds.length });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.department.findUnique({ where: { id }, include: { employees: true, jobOpenings: true, designations: true } });
    if (!item) throw ApiError.notFound("Department not found.");
    return ok(res, { item });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { name, code, description, isActive = true } = parsed.data;
    const exists = await prisma.department.findFirst({ where: { OR: [{ name }, { code }] } });
    if (exists) throw ApiError.conflict("Department with this name or code already exists.");
    const item = await prisma.department.create({ data: { name, code, description, isActive } });
    await cache.openingsChanged();
    await logAudit(req, { action: "DEPARTMENT_CREATE", entityType: "Department", entityId: item.id, actorId: undefined, actorEmail: undefined });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const item = await prisma.department.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Department not found.");
    if (parsed.data.name || parsed.data.code) {
      const or: Array<{ name?: string; code?: string }> = [];
      if (parsed.data.name) or.push({ name: parsed.data.name });
      if (parsed.data.code) or.push({ code: parsed.data.code });
      const conflict = await prisma.department.findFirst({ where: { id: { not: id }, OR: or } });
      if (conflict) throw ApiError.conflict("Department name or code already in use.");
    }
    const updated = await prisma.department.update({ where: { id }, data: { name: parsed.data.name, code: parsed.data.code, description: parsed.data.description, isActive: parsed.data.isActive } });
    await cache.openingsChanged();
    await logAudit(req, { action: "DEPARTMENT_UPDATE", entityType: "Department", entityId: id, actorId: undefined, actorEmail: undefined });
    return ok(res, { item: updated });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true, jobOpenings: true } } } });
    if (!item) throw ApiError.notFound("Department not found.");
    if (item._count.employees > 0 || item._count.jobOpenings > 0) {
      await prisma.department.update({ where: { id }, data: { isActive: false } });
      return ok(res, { message: "Department has records; it has been deactivated instead of deleted." });
    }
    await prisma.department.delete({ where: { id } });
    await cache.openingsChanged();
    await cache.peopleChanged();
    await logAudit(req, { action: "DEPARTMENT_DELETE", entityType: "Department", entityId: id, actorId: undefined, actorEmail: undefined });
    return ok(res, { message: "Department deleted." });
  }),
);

export default router;
