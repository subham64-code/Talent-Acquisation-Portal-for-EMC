import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requireCandidate, requirePermission } from "../middleware/auth";
import { logAudit } from "../services/audit.service";
import { cache } from "../services/cache.service";
import { upload } from "../middleware/upload";
import { storeFile, STORAGE_BUCKETS } from "../storage/index";
import { env } from "../config/env";

const router = express.Router();
// Mounted at /api/v1/candidates in server.ts, so this only guards /candidates/*.
router.use(authenticate);

const candSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  mobile: z.string().optional().nullable(),
  currentLocation: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  graduationYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  totalExperience: z.coerce.number().nonnegative().optional().nullable(),
  relevantExperience: z.coerce.number().nonnegative().optional().nullable(),
  currentOrganization: z.string().optional().nullable(),
  currentDesignation: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  linkedin: z.string().url().optional().nullable().or(z.literal("")),
  additionalInfo: z.string().optional().nullable(),
});

router.get(
  "/",
  requireAuth("HR"),
  requireHr,
  requirePermission("candidates.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (search) where.OR = [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { mobile: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      prisma.candidate.findMany({ where, skip, take, orderBy: { fullName: "asc" }, include: { skills: { include: { skill: true } }, cvFile: true } }),
      prisma.candidate.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/me",
  requireCandidate,
  asyncHandler(async (req, res) => {
    const item = await prisma.candidate.findUnique({
      where: { id: req.auth!.candidateId! },
      include: { skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true, cvFile: true, applications: { include: { jobOpening: true }, orderBy: { appliedAt: "desc" } } },
    });
    if (!item) throw ApiError.notFound("Profile not found.");
    return ok(res, { item });
  }),
);

router.put(
  "/me",
  requireCandidate,
  asyncHandler(async (req, res) => {
    const parsed = candSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { email } = parsed.data;
    const current = await prisma.candidate.findUnique({ where: { id: req.auth!.candidateId! } });
    if (!current) throw ApiError.notFound("Profile not found.");
    if (email && email !== current.email) {
      const exists = await prisma.candidate.findUnique({ where: { email } });
      if (exists) throw ApiError.conflict("Email already in use.");
    }
    const item = await prisma.candidate.update({ where: { id: req.auth!.candidateId! }, data: parsed.data });
    await cache.peopleChanged();
    await logAudit(req, { action: "CANDIDATE_PROFILE_UPDATE", entityType: "Candidate", entityId: item.id, actorId: req.auth!.candidateId, actorEmail: item.email });
    return ok(res, { item });
  }),
);

router.post(
  "/me/cv",
  requireCandidate,
  upload.single("cv"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("CV file is required.");
    const candidate = await prisma.candidate.findUnique({ where: { id: req.auth!.candidateId! } });
    if (!candidate) throw ApiError.notFound("Candidate not found.");
    const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "CANDIDATE", ownerId: candidate.id, bucket: STORAGE_BUCKETS.RESUMES, visibility: "PRIVATE" });
    await prisma.cvVersion.create({ data: { candidateId: candidate.id, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD" } });
    await prisma.candidate.update({ where: { id: candidate.id }, data: { cvFileId: file.id } });
    await cache.peopleChanged();
    await logAudit(req, { action: "CANDIDATE_CV_UPLOAD", entityType: "Candidate", entityId: candidate.id, actorId: null, actorEmail: candidate.email, metadata: { actorType: "CANDIDATE", candidateId: candidate.id } });
    return ok(res, { fileId: file.id, message: "CV uploaded." });
  }),
);
router.post(
  "/:id/cv",
  requireAuth("HR"),
  requireHr,
  requirePermission("candidates.manage"),
  upload.single("cv"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    if (!req.file) throw ApiError.badRequest("CV file is required.");
    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) throw ApiError.notFound("Candidate not found.");
    const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "CANDIDATE", ownerId: id, uploadedById: req.auth!.subjectId, bucket: STORAGE_BUCKETS.RESUMES, visibility: "PRIVATE" });
    await prisma.cvVersion.create({ data: { candidateId: id, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD", uploadedById: req.auth!.subjectId } });
    await prisma.candidate.update({ where: { id }, data: { cvFileId: file.id } });
    await cache.peopleChanged();
    await logAudit(req, { action: "CANDIDATE_CV_UPLOAD", entityType: "Candidate", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { fileId: file.id, message: "CV uploaded." });
  }),
);

const skillSchema = z.object({ skillId: z.string().min(1).optional(), skillName: z.string().min(2).optional(), level: z.string().optional() });

router.post(
  "/me/skills",
  requireCandidate,
  asyncHandler(async (req, res) => {
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Provide skillId or skillName.", parsed.error.flatten());
    const { skillId, skillName, level } = parsed.data;
    let skill;
    if (skillId) {
      skill = await prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill) throw ApiError.notFound("Skill not found.");
    } else if (skillName) {
      skill = await prisma.skill.upsert({ where: { name: skillName.trim() }, create: { name: skillName.trim() }, update: {} });
    } else {
      throw ApiError.badRequest("Provide skillId or skillName.");
    }
    await prisma.candidateSkill.upsert({
      where: { candidateId_skillId: { candidateId: req.auth!.candidateId!, skillId: skill.id } },
      update: { level },
      create: { candidateId: req.auth!.candidateId!, skillId: skill.id, level },
    });
    await logAudit(req, { action: "CANDIDATE_SKILL_ADD", entityType: "CandidateSkill", entityId: skill.id, actorId: req.auth!.candidateId, actorEmail: req.auth!.email });
    return ok(res, { skill });
  }),
);

router.delete(
  "/me/skills/:skillId",
  requireCandidate,
  asyncHandler(async (req, res) => {
    const { skillId } = z.object({ skillId: z.string().min(1) }).parse(req.params);
    await prisma.candidateSkill.deleteMany({ where: { candidateId: req.auth!.candidateId!, skillId } });
    await logAudit(req, { action: "CANDIDATE_SKILL_REMOVE", entityType: "CandidateSkill", entityId: skillId, actorId: req.auth!.candidateId, actorEmail: req.auth!.email });
    return ok(res, { message: "Skill removed." });
  }),
);

// NOTE: keep wildcard routes last so they do not shadow /me routes above.
router.get(
  "/:id",
  requireAuth("HR"),
  requireHr,
  requirePermission("candidates.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.candidate.findUnique({
      where: { id },
      include: { skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true, cvFile: true, cvVersions: { include: { file: true, uploadedBy: true } }, applications: { include: { jobOpening: true }, orderBy: { appliedAt: "desc" } } },
    });
    if (!item) throw ApiError.notFound("Candidate not found.");
    return ok(res, { item });
  }),
);

export default router;
