import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { cached, CACHE_KEYS } from "../lib/cache";
import { cache } from "../services/cache.service";
import { logAudit } from "../services/audit.service";
import { notifyHrTeam } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { cvUpload } from "../middleware/upload";
import { storeFile, STORAGE_BUCKETS } from "../storage/index";
import { env } from "../config/env";
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS } from "../config/constants";
import { publicRateLimiter, applicationRateLimiter } from "../middleware/rateLimit";

const router = express.Router();
router.use(publicRateLimiter);

function isOpenForApplications(opening: { status: string; deadline: Date | null; positions: number }): boolean {
  return opening.status === "PUBLISHED"
    && (!opening.deadline || opening.deadline.getTime() >= Date.now())
    && opening.positions > 0;
}

router.get(
  "/career/departments",
  asyncHandler(async (_req, res) => {
    const departments = await cached(CACHE_KEYS.publicDepartments(), env.cacheTtlSeconds, async () =>
      prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    );
    return ok(res, { departments });
  }),
);

router.get(
  "/career/employee-update/dropdowns",
  asyncHandler(async (_req, res) => {
    const [departments, designations, employmentTypes] = await Promise.all([
      prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
      prisma.designation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.employmentType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return ok(res, { departments, designations, employmentTypes });
  }),
);

router.get(
  "/career/openings",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const departmentId = typeof req.query.departmentId === "string" && req.query.departmentId ? req.query.departmentId : "";
    // Every condition is combined with AND so search/department filters can never
    // overwrite the "published and not expired" constraint. Previously assigning
    // `where.OR` for search replaced the deadline guard and leaked closed openings.
    const and: any[] = [{ OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }];
    if (search) {
      and.push({ OR: [{ title: { contains: search, mode: "insensitive" } }, { jobCode: { contains: search, mode: "insensitive" } }] });
    }
    if (departmentId) and.push({ departmentId });
    and.push({ positions: { gt: 0 } });
    const where: any = { status: "PUBLISHED", AND: and };
    const [items, total] = await Promise.all([
      cached(
        CACHE_KEYS.publicOpenings(page, pageSize, search ?? "", departmentId),
        env.cacheTtlSeconds,
        async () =>
          prisma.jobOpening.findMany({
            where, skip, take, orderBy: { createdAt: "desc" },
            include: { department: true, program: true, employmentType: true },
          }),
      ),
      prisma.jobOpening.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/career/openings/:id/availability",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({
      where: { id },
      select: { status: true, deadline: true, positions: true, publishedAt: true },
    });
    if (!item || item.status !== "PUBLISHED") {
      throw ApiError.notFound("Opening not found or not open for applications.");
    }
    const accepting = isOpenForApplications(item);
    return ok(res, {
      accepting,
      reason: accepting ? null : item.deadline && item.deadline.getTime() < Date.now() ? "APPLICATION_DEADLINE_PASSED" : "NO_VACANCIES",
      deadline: item.deadline,
      positions: item.positions,
    });
  }),
);

router.get(
  "/career/openings/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({
      where: { id, status: "PUBLISHED" },
      include: { department: true, program: true, employmentType: true },
    });
    if (!item) throw ApiError.notFound("Opening not found or not open for applications.");
    return ok(res, {
      item,
      accepting: isOpenForApplications(item),
      deadline: item.deadline,
      positions: item.positions,
    });
  }),
);

router.get(
  "/career/applications/status",
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({ reference: z.string().min(1), email: z.string().email() })
      .safeParse(req.query);
    if (!parsed.success) throw ApiError.badRequest("Enter your application reference and a valid email address.");
    const reference = parsed.data.reference.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const application = await prisma.application.findFirst({
      where: {
        applicationCode: { equals: reference, mode: "insensitive" },
        candidate: { email: { equals: email, mode: "insensitive" } },
      },
      select: {
        id: true,
        applicationCode: true,
        status: true,
        appliedAt: true,
        updatedAt: true,
        candidate: { select: { fullName: true } },
        jobOpening: {
          select: {
            title: true,
            jobCode: true,
            location: true,
            department: { select: { name: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: { id: true, fromStatus: true, toStatus: true, createdAt: true },
        },
      },
    });
    if (!application) throw ApiError.notFound("No application found for that reference and email address.");
    return ok(res, {
      application: {
        reference: application.applicationCode,
        status: application.status,
        statusLabel: APPLICATION_STATUS_LABELS[application.status] ?? application.status,
        appliedAt: application.appliedAt,
        updatedAt: application.updatedAt,
        candidateName: application.candidate.fullName,
        jobTitle: application.jobOpening.title,
        jobCode: application.jobOpening.jobCode,
        location: application.jobOpening.location,
        department: application.jobOpening.department?.name ?? null,
      },
      history: application.statusHistory.map((entry) => ({
        from: entry.fromStatus,
        to: entry.toStatus,
        label: APPLICATION_STATUS_LABELS[entry.toStatus] ?? entry.toStatus,
        at: entry.createdAt,
      })),
    });
  }),
);

const MOBILE_REGEX = /^[6-9]\d{9}$/;

// Exactly the inputs of the original EMC careers apply form, plus one CV file.
// No extra candidate fields are added or renamed anywhere in the pipeline.
// The live EMC website submits camelCase aliases (openingId/fullName/coverLetter),
// phones like "+91 98765 43210" and experience like "3 years" — those are
// normalized below so both the original form and the live site work unchanged.
const applySchema = z.object({
  job_id: z.string().min(1),
  job_title: z.string().optional().nullable(),
  full_name: z.string().min(2).max(120),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  phone: z
    .string()
    .trim()
    .transform((v) => {
      let digits = v.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
      else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
      return digits;
    })
    .refine((v) => /^\d{10}$/.test(v), "Enter a valid 10-digit phone number."),
  experience: z
    .string()
    .trim()
    .transform((v) => v.match(/\d+/)?.[0] ?? v)
    .refine((v) => /^\d{1,2}$/.test(v), "Enter a valid experience in years (0-60).")
    .refine((v) => Number(v) <= 60, "Enter a valid experience in years (0-60)."),
  cover_letter: z.string().optional().nullable(),
});

const EMC_FORM_FIELDS = ["job_id", "job_title", "full_name", "email", "phone", "experience", "cover_letter"] as const;

/** Map the live EMC website's field names onto the canonical apply schema keys. */
function normalizeApplyBody(req: express.Request): Record<string, unknown> {
  const body: Record<string, unknown> = { ...(req.body || {}) };
  const alias = (target: string, ...sources: string[]) => {
    const current = body[target];
    if (current !== undefined && current !== null && current !== "") return;
    for (const source of sources) {
      const value = body[source];
      if (value !== undefined && value !== null && value !== "") {
        body[target] = value;
        return;
      }
    }
  };
  alias("job_id", "openingId", "jobOpeningId", "jobId");
  alias("full_name", "fullName", "name");
  alias("cover_letter", "coverLetter");
  alias("job_title", "jobTitle", "title");
  return body;
}

function emcFormData(body: Record<string, unknown>): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const field of EMC_FORM_FIELDS) {
    const value = body?.[field];
    if (typeof value === "string") raw[field] = value;
  }
  return raw;
}

/**
 * Accept the CV under either canonical field name ("cv") or the live EMC
 * website's field name ("resume") so both callers keep working.
 */
function acceptCvField(req: express.Request, res: express.Response, next: express.NextFunction) {
  const handle = cvUpload.fields([
    { name: "cv", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]);
  handle(req, res, (err: unknown) => {
    if (err) return next(err);
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = files?.cv?.[0] ?? files?.resume?.[0];
    if (file) req.file = file;
    return next();
  });
}

function asNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Candidate codes follow EMC<YYYY><MM>C<n>, e.g. EMC202611C1 for the first
 * candidate registered in November 2026. The sequence resets per month.
 */
async function nextCandidateCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `EMC${year}${month}C`;
  const existing = await prisma.candidate.findMany({ where: { candidateCode: { startsWith: prefix } }, select: { candidateCode: true } });
  const maxSeq = existing.reduce((max, row) => {
    const seq = Number.parseInt(row.candidateCode.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${maxSeq + 1}`;
}

/** Application codes follow <jobCode>/A<n>, e.g. EMC202611J1/A1, sequenced per job. */
async function nextApplicationCode(jobCode: string): Promise<string> {
  const prefix = `${jobCode}/A`;
  const existing = await prisma.application.findMany({ where: { applicationCode: { startsWith: prefix } }, select: { applicationCode: true } });
  const maxSeq = existing.reduce((max, row) => {
    const seq = Number.parseInt(row.applicationCode.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${maxSeq + 1}`;
}

router.post(
  "/career/applications",
  applicationRateLimiter,
  acceptCvField,
  asyncHandler(async (req, res) => {
    const body = normalizeApplyBody(req);
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      const firstField = Object.keys(flat)[0];
      const firstMessage = firstField ? flat[firstField]?.[0] : undefined;
      throw ApiError.badRequest(firstMessage || "Please check the highlighted fields and try again.", parsed.error.flatten());
    }
    const data = parsed.data;
    const raw = emcFormData(body);
    if (!req.file) throw ApiError.badRequest("Please attach your CV (PDF, DOC or DOCX, maximum 10 MB).");
    const job = await prisma.jobOpening.findUnique({ where: { id: data.job_id, status: "PUBLISHED" } });
    if (!job) throw ApiError.notFound("Opening not found or not accepting applications.");
    if (!isOpenForApplications(job)) {
      throw ApiError.conflict("This opening is closed or its application deadline has passed.");
    }

    const email = data.email;
    let candidate = await prisma.candidate.findUnique({ where: { email } });

    const candidateProfile = {
      fullName: data.full_name,
      mobile: data.phone,
      totalExperience: Number(data.experience),
      additionalInfo: JSON.stringify(raw),
    };

    if (candidate) {
      candidate = await prisma.candidate.update({ where: { id: candidate.id }, data: candidateProfile });
    } else {
      candidate = await prisma.candidate.create({
        data: { candidateCode: await nextCandidateCode(), email, status: "ACTIVE", ...candidateProfile },
      });
    }
    const candidateId = candidate.id;

    const existing = await prisma.application.findFirst({ where: { candidateId, jobOpeningId: data.job_id } });
    if (existing) throw ApiError.conflict("You have already applied for this position with this email address.");

    const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "CANDIDATE", ownerId: candidateId, bucket: STORAGE_BUCKETS.APPLICATIONS, visibility: "PRIVATE" });
    const resumeFileId = file.id;
    await prisma.cvVersion.create({ data: { candidateId, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD" } });
    await prisma.candidate.update({ where: { id: candidateId }, data: { cvFileId: file.id } });

    const application = await prisma.application.create({
      data: {
        ...raw,
        cv_file_name: req.file.originalname,
        applicationCode: await nextApplicationCode(job.jobCode),
        candidateId,
        jobOpeningId: data.job_id,
        status: APPLICATION_STATUS.APPLIED,
        coverLetter: data.cover_letter || null,
        resumeFileId,
      },
      include: { candidate: true, jobOpening: { include: { department: true } } },
    });

    void sendTemplateEmail({
      to: candidate.email,
      templateKey: "application_confirmation",
      data: {
        name: candidate.fullName, jobTitle: application.jobOpening.title, applicationCode: application.applicationCode,
        department: application.jobOpening.department?.name, appliedAt: application.appliedAt.toISOString(),
        link: `${env.trackApplicationUrl}?ref=${encodeURIComponent(application.applicationCode)}&email=${encodeURIComponent(candidate.email)}`,
      },
      metadata: { applicationId: application.id },
    });
    await notifyHrTeam({ type: "application.new", title: "New application", body: `${candidate.fullName} applied for ${job.title}.`, entityType: "Application", entityId: application.id });
    await cache.applicationsChanged();
    await logAudit(req, { action: "APPLICATION_CREATE", entityType: "Application", entityId: application.id, actorId: null, actorEmail: candidate.email, metadata: { jobOpeningId: data.job_id, actorType: "CANDIDATE", candidateId } });

    return created(res, {
      // Flat convenience fields so simple clients can read the reference
      // without digging into the nested application object.
      reference: application.applicationCode,
      applicationId: application.id,
      application: {
        id: application.id,
        applicationCode: application.applicationCode,
        status: application.status,
        jobTitle: application.jobOpening.title,
        department: application.jobOpening.department?.name ?? null,
        appliedAt: application.appliedAt,
      },
    });
  }),
);

export default router;
