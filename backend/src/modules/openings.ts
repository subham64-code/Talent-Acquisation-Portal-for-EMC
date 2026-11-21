import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission, departmentScope } from "../middleware/auth";
import { logAudit } from "../services/audit.service";
import { cache } from "../services/cache.service";
import { upload } from "../middleware/upload";
import { storeFile, STORAGE_BUCKETS } from "../storage/index";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const arrayField = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val.split(",").map((s) => s.trim()).filter(Boolean); }
  }
  return [];
}, z.array(z.string()).default([]));

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const openingSchema = z.object({
  jobCode: z.preprocess(emptyToUndefined, z.string().min(2).max(30).optional()),
  title: z.string().min(2).max(160),
  departmentId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  programId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  positions: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  location: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  employmentTypeId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  requiredQualification: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  minExperience: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional().nullable()),
  maxExperience: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional().nullable()),
  relevantExperience: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional().nullable()),
  requiredSkills: arrayField,
  preferredSkills: arrayField,
  description: z.string().min(1),
  responsibilities: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  requiredCertifications: arrayField,
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  deadline: z.preprocess(emptyToUndefined, z.coerce.date().optional().nullable()),
  status: z.preprocess(emptyToUndefined, z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional()),
});

const invalidInput = (parsed: { error: z.ZodError }) => {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join("; ");
  return ApiError.badRequest(`Invalid input — ${details}`, parsed.error.flatten());
};

router.get(
  "/",
  requirePermission("openings.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.departmentId) where.departmentId = String(req.query.departmentId);
    // Department-scoped HR roles (e.g. Department Manager) only see their departments.
    const scope = departmentScope(req.auth);
    if (scope !== null) {
      if (req.query.departmentId) {
        const wanted = String(req.query.departmentId);
        where.departmentId = scope.includes(wanted) ? wanted : { in: [] };
      } else {
        where.departmentId = { in: scope };
      }
    }
    if (search) where.OR = [{ title: { contains: search, mode: "insensitive" } }, { jobCode: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      prisma.jobOpening.findMany({
        where, skip, take, orderBy: { createdAt: "desc" },
        include: { department: true, program: true, employmentType: true, _count: { select: { applications: true } } },
      }),
      prisma.jobOpening.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get("/next-code", requirePermission("openings.manage"), asyncHandler(async (_req, res) => {
  return ok(res, { jobCode: await nextJobCode() });
}));

router.get("/dropdown", requirePermission("openings.view"), asyncHandler(async (_req, res) => {
  const items = await prisma.jobOpening.findMany({ where: { status: "PUBLISHED" }, select: { id: true, jobCode: true, title: true, departmentId: true }, orderBy: { title: "asc" } });
  return ok(res, { items });
}));

router.get(
  "/:id",
  requirePermission("openings.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({
      where: { id },
      include: { department: true, program: true, employmentType: true, jdFile: true, applications: { include: { candidate: true }, orderBy: { appliedAt: "desc" }, take: 50 }, requirements: true },
    });
    if (!item) throw ApiError.notFound("Opening not found.");
    return ok(res, { item });
  }),
);

/**
 * Resolves a program reference supplied by the UI. Accepts either a Program id or a
 * Program name; unknown names are created so HR can type a new program directly.
 */
async function resolveProgramId(programId?: string | null): Promise<string | null> {
  const value = (programId ?? "").trim();
  if (!value) return null;
  const byId = await prisma.program.findUnique({ where: { id: value } });
  if (byId) return byId.id;
  const byName = await prisma.program.findUnique({ where: { name: value } });
  if (byName) return byName.id;
  const created = await prisma.program.create({ data: { name: value, description: `Program ${value}` } });
  return created.id;
}

async function assertExists(model: "department" | "employmentType" | "designation", id: string | null | undefined, label: string): Promise<string | null> {
  const value = (id ?? "").trim();
  if (!value) return null;
  const record = await (model === "department"
    ? prisma.department.findUnique({ where: { id: value } })
    : model === "employmentType"
      ? prisma.employmentType.findUnique({ where: { id: value } })
      : prisma.designation.findUnique({ where: { id: value } }));
  if (!record) throw ApiError.badRequest(`Invalid ${label}. Please select a valid option.`);
  return record.id;
}

/**
 * Job codes follow EMC<YYYY><MM>J<n>, e.g. EMC202611J1 for the first opening
 * created in November 2026. The sequence resets per month.
 */
async function nextJobCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `EMC${year}${month}J`;
  const existing = await prisma.jobOpening.findMany({ where: { jobCode: { startsWith: prefix } }, select: { jobCode: true } });
  const maxSeq = existing.reduce((max, opening) => {
    const seq = Number.parseInt(opening.jobCode.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${maxSeq + 1}`;
}

router.post(
  "/",
  requirePermission("openings.manage"),
  upload.single("jdFile"),
  asyncHandler(async (req, res) => {
    const parsed = openingSchema.safeParse(req.body);
    if (!parsed.success) throw invalidInput(parsed);
    const data = parsed.data;
    const departmentId = await assertExists("department", data.departmentId, "department");
    const programId = await resolveProgramId(data.programId);
    const employmentTypeId = await assertExists("employmentType", data.employmentTypeId, "employment type");
    let jdFileId: string | undefined;
    if (req.file) {
      const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "JOB_OPENING", uploadedById: req.auth!.subjectId, bucket: STORAGE_BUCKETS.JOB_DESCRIPTIONS, visibility: "PRIVATE" });
      jdFileId = file.id;
    }
    const createData = (jobCode: string) => ({
      jobCode,
      title: data.title,
      departmentId: departmentId || undefined,
      programId,
      positions: data.positions,
      location: data.location,
      employmentTypeId,
      requiredQualification: data.requiredQualification,
      minExperience: data.minExperience,
      maxExperience: data.maxExperience,
      relevantExperience: data.relevantExperience,
      requiredSkills: data.requiredSkills,
      preferredSkills: data.preferredSkills,
      description: data.description,
      responsibilities: data.responsibilities,
      requiredCertifications: data.requiredCertifications,
      startDate: data.startDate,
      deadline: data.deadline,
      jdFileId,
      status: data.status ?? "DRAFT",
      publishedAt: (data.status ?? "DRAFT") === "PUBLISHED" ? new Date() : null,
      createdById: req.auth!.subjectId,
    });
    const createOpening = (jobCode: string) =>
      prisma.jobOpening.create({
        data: createData(jobCode),
        include: { department: true, program: true, employmentType: true },
      });
    let jobCode = data.jobCode?.trim() || (await nextJobCode());
    let item;
    try {
      item = await createOpening(jobCode);
    } catch (err: any) {
      // The previewed code was claimed in the meantime — fall back to a fresh code.
      if (err?.code === "P2002") {
        jobCode = await nextJobCode();
        item = await createOpening(jobCode);
      } else {
        throw err;
      }
    }
    await cache.openingsChanged();
    await logAudit(req, { action: "OPENING_CREATE", entityType: "JobOpening", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { title: item.title } });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  requirePermission("openings.manage"),
  upload.single("jdFile"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = openingSchema.safeParse(req.body);
    if (!parsed.success) throw invalidInput(parsed);
    const item = await prisma.jobOpening.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Opening not found.");
    let jdFileId = item.jdFileId;
    if (req.file) {
      const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "JOB_OPENING", uploadedById: req.auth!.subjectId, bucket: STORAGE_BUCKETS.JOB_DESCRIPTIONS, visibility: "PRIVATE" });
      jdFileId = file.id;
    }
    const data = parsed.data;
    const departmentId = await assertExists("department", data.departmentId, "department");
    const programId = await resolveProgramId(data.programId);
    const employmentTypeId = await assertExists("employmentType", data.employmentTypeId, "employment type");
    const updated = await prisma.jobOpening.update({ where: { id }, data: { title: data.title, departmentId: departmentId ?? item.departmentId, programId, positions: data.positions, location: data.location, employmentTypeId, requiredQualification: data.requiredQualification, minExperience: data.minExperience, maxExperience: data.maxExperience, relevantExperience: data.relevantExperience, requiredSkills: data.requiredSkills, preferredSkills: data.preferredSkills, description: data.description, responsibilities: data.responsibilities, requiredCertifications: data.requiredCertifications, startDate: data.startDate, deadline: data.deadline, jdFileId, status: data.status }, include: { department: true, program: true, employmentType: true } });
    await cache.openingsChanged();
    await logAudit(req, { action: "OPENING_UPDATE", entityType: "JobOpening", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: parsed.data });
    return ok(res, { item: updated });
  }),
);

function statusAction(status: "PUBLISHED" | "CLOSED" | "ARCHIVED") {
  return asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Opening not found.");
    const data: Record<string, unknown> = { status, closedAt: ["CLOSED", "ARCHIVED"].includes(status) ? new Date() : null, publishedAt: status === "PUBLISHED" ? new Date() : item.publishedAt };
    if (status === "PUBLISHED") data.closedAt = null;
    const updated = await prisma.jobOpening.update({ where: { id }, data });
    await cache.openingsChanged();
    await logAudit(req, { action: `OPENING_${status}`, entityType: "JobOpening", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  });
}

router.post("/:id/publish", requirePermission("openings.manage"), statusAction("PUBLISHED"));
router.post("/:id/close", requirePermission("openings.manage"), statusAction("CLOSED"));
router.post("/:id/archive", requirePermission("openings.manage"), statusAction("ARCHIVED"));

router.post(
  "/:id/reopen",
  requirePermission("openings.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Opening not found.");
    const updated = await prisma.jobOpening.update({ where: { id }, data: { status: "PUBLISHED", closedAt: null, publishedAt: new Date() } });
    await cache.openingsChanged();
    await logAudit(req, { action: "OPENING_REOPEN", entityType: "JobOpening", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.delete(
  "/:id",
  requirePermission("openings.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!item) throw ApiError.notFound("Opening not found.");
    if (item._count.applications > 0) throw ApiError.badRequest("Cannot delete an opening that has applications. Close it instead.");
    await prisma.jobOpening.delete({ where: { id } });
    await cache.openingsChanged();
    await logAudit(req, { action: "OPENING_DELETE", entityType: "JobOpening", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "Opening deleted." });
  }),
);

export default router;
