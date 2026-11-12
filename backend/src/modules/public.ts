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
import { APPLICATION_STATUS } from "../config/constants";

const router = express.Router();

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
  "/career/openings",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {
      status: "PUBLISHED",
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    };
    if (search) where.OR = [{ title: { contains: search, mode: "insensitive" } }, { jobCode: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      cached(
        CACHE_KEYS.publicOpenings(page, pageSize, search ?? "", (req.query.departmentId as string) ?? ""),
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
  "/career/openings/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.jobOpening.findUnique({
      where: { id, status: "PUBLISHED" },
      include: { department: true, program: true, employmentType: true },
    });
    if (!item) throw ApiError.notFound("Opening not found or not open for applications.");
    return ok(res, { item });
  }),
);

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const listField = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String).map((s) => s.trim()).filter(Boolean)
    : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const applySchema = z.object({
  jobOpeningId: z.string().min(1),
  coverLetter: z.string().optional().nullable(),
  fullName: z.string().min(2).max(120),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  mobile: z.string().transform((v) => v.replace(/[\s()-]/g, "")).pipe(z.string().regex(MOBILE_REGEX, "Mobile number must be exactly 10 digits and start with 6-9.")),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  currentAddress: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  currentLocation: z.string().optional().nullable(),
  qualifications: z.string().optional().nullable(),
  highestQualification: z.string().optional().nullable(),
  course: z.string().optional().nullable(),
  specializationStream: z.string().optional().nullable(),
  college: z.string().optional().nullable(),
  passingYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  percentage: z.string().optional().nullable(),
  totalExperience: z.coerce.number().nonnegative().optional().nullable(),
  relevantExperience: z.coerce.number().nonnegative().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  currentDesignation: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  workSpecialization: z.string().optional().nullable(),
  technicalSkills: z.string().optional().nullable(),
  professionalSkills: z.string().optional().nullable(),
  employmentStatus: z.string().optional().nullable(),
  expectedSalary: z.string().optional().nullable(),
  noticePeriod: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  graduationYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  currentOrganization: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  linkedin: z.string().url().optional().nullable().or(z.literal("")),
  additionalInfo: z.string().optional().nullable(),
});

router.post(
  "/career/applications",
  cvUpload.single("cv"),
  asyncHandler(async (req, res) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      const firstField = Object.keys(flat)[0];
      const firstMessage = firstField ? flat[firstField]?.[0] : undefined;
      throw ApiError.badRequest(firstMessage || "Please check the highlighted fields and try again.", parsed.error.flatten());
    }
    const { jobOpeningId, coverLetter } = parsed.data;
    if (!req.file) throw ApiError.badRequest("Please attach your CV (PDF, DOC or DOCX, maximum 10 MB).");
    const job = await prisma.jobOpening.findUnique({ where: { id: jobOpeningId, status: "PUBLISHED" } });
    if (!job) throw ApiError.notFound("Opening not found or not accepting applications.");

    const email = parsed.data.email;
    let candidate = await prisma.candidate.findUnique({ where: { email } });

    const completeLocation = parsed.data.currentLocation
      || [parsed.data.city, parsed.data.state, parsed.data.country].filter(Boolean).join(", ")
      || null;
    const profileExtra = {
      country: parsed.data.country, state: parsed.data.state, city: parsed.data.city,
      address: parsed.data.currentAddress, dateOfBirth: parsed.data.dateOfBirth, gender: parsed.data.gender,
      highestQualification: parsed.data.highestQualification, qualifications: listField(parsed.data.qualifications),
      course: parsed.data.course, stream: parsed.data.specializationStream, college: parsed.data.college,
      passingYear: parsed.data.passingYear, percentage: parsed.data.percentage,
      employmentStatus: parsed.data.employmentStatus, expectedSalary: parsed.data.expectedSalary,
      noticePeriod: parsed.data.noticePeriod, currentDepartment: parsed.data.department,
      technicalSkills: listField(parsed.data.technicalSkills), professionalSkills: listField(parsed.data.professionalSkills),
    };
    const additionalInfo = JSON.stringify(profileExtra);
    const qualificationSummary = parsed.data.highestQualification || parsed.data.qualification || null;

    if (candidate) {
      candidate = await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          fullName: parsed.data.fullName,
          mobile: parsed.data.mobile,
          currentLocation: completeLocation,
          qualification: qualificationSummary,
          graduationYear: parsed.data.graduationYear ?? parsed.data.passingYear ?? null,
          totalExperience: parsed.data.totalExperience,
          relevantExperience: parsed.data.relevantExperience,
          currentOrganization: parsed.data.currentCompany ?? parsed.data.currentOrganization ?? null,
          currentDesignation: parsed.data.currentDesignation,
          specialization: parsed.data.workSpecialization ?? parsed.data.specialization ?? null,
          linkedin: parsed.data.linkedin || null,
          additionalInfo,
        },
      });
    } else {
      candidate = await prisma.candidate.create({
        data: {
          candidateCode: "CAN" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
          fullName: parsed.data.fullName,
          email,
          mobile: parsed.data.mobile,
          currentLocation: completeLocation,
          qualification: qualificationSummary,
          graduationYear: parsed.data.graduationYear ?? parsed.data.passingYear ?? null,
          totalExperience: parsed.data.totalExperience,
          relevantExperience: parsed.data.relevantExperience,
          currentOrganization: parsed.data.currentCompany ?? parsed.data.currentOrganization ?? null,
          currentDesignation: parsed.data.currentDesignation,
          specialization: parsed.data.workSpecialization ?? parsed.data.specialization ?? null,
          linkedin: parsed.data.linkedin || null,
          additionalInfo,
          status: "ACTIVE",
        },
      });
    }
    const candidateId = candidate.id;

    const existing = await prisma.application.findFirst({ where: { candidateId, jobOpeningId } });
    if (existing) throw ApiError.conflict("You have already applied for this position with this email address.");

    if (parsed.data.college || parsed.data.course || parsed.data.highestQualification) {
      await prisma.educationRecord.create({
        data: {
          candidateId,
          degree: parsed.data.course || parsed.data.highestQualification || "Education",
          institution: parsed.data.college ?? null,
          field: parsed.data.specializationStream ?? null,
          endYear: parsed.data.passingYear ?? null,
          grade: parsed.data.percentage ?? null,
        },
      }).catch(() => undefined);
    }
    for (const skillName of [...listField(parsed.data.technicalSkills), ...listField(parsed.data.professionalSkills)]) {
      try {
        const skill = await prisma.skill.upsert({ where: { name: skillName }, create: { name: skillName }, update: {} });
        await prisma.candidateSkill.create({ data: { candidateId, skillId: skill.id } }).catch(() => undefined);
      } catch { /* skill linking is best effort */ }
    }

    const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "CANDIDATE", ownerId: candidateId, bucket: STORAGE_BUCKETS.APPLICATIONS, visibility: "PRIVATE" });
    const resumeFileId = file.id;
    await prisma.cvVersion.create({ data: { candidateId, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD" } });
    await prisma.candidate.update({ where: { id: candidateId }, data: { cvFileId: file.id } });

    const application = await prisma.application.create({
      data: {
        applicationCode: "APP" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
        candidateId, jobOpeningId, status: APPLICATION_STATUS.APPLIED, coverLetter, resumeFileId,
      },
      include: { candidate: true, jobOpening: { include: { department: true } } },
    });

    void sendTemplateEmail({
      to: candidate.email,
      templateKey: "application_confirmation",
      data: {
        name: candidate.fullName, jobTitle: application.jobOpening.title, applicationCode: application.applicationCode,
        department: application.jobOpening.department?.name, appliedAt: application.appliedAt.toISOString(), link: `${env.appUrl}/career`,
      },
      metadata: { applicationId: application.id },
    });
    await notifyHrTeam({ type: "application.new", title: "New application", body: `${candidate.fullName} applied for ${job.title}.`, entityType: "Application", entityId: application.id });
    await cache.applicationsChanged();
    await logAudit(req, { action: "APPLICATION_CREATE", entityType: "Application", entityId: application.id, actorId: candidateId, actorEmail: candidate.email, metadata: { jobOpeningId } });

    return created(res, {
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
