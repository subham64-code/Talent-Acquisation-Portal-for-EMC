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
import { notifyHrTeam, notifyCandidate } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { extractText, parseStructured } from "../ai/extract";
import { scoreMatch, canonicalize } from "../ai/scoring";
import { readStoredFile } from "../storage/index";
import { env } from "../config/env";
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, APPLICATION_TRANSITIONS } from "../config/constants";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const runSchema = z.object({ jobOpeningId: z.string().min(1), includeInternal: z.coerce.boolean().optional().default(false) });

router.post(
  "/run",
  requirePermission("ai.run"),
  asyncHandler(async (req, res) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { jobOpeningId } = parsed.data;

    const job = await prisma.jobOpening.findUnique({
      where: { id: jobOpeningId },
      include: { department: true, program: true },
    });
    if (!job) throw ApiError.notFound("Job opening not found.");

    const applications = await prisma.application.findMany({
      where: { jobOpeningId },
      include: { candidate: { include: { skills: { include: { skill: true } } } }, resumeFile: true },
      orderBy: { appliedAt: "desc" },
    });

    const weights = env.aiWeights;
    let evaluated = 0;
    let topScore = 0;
    const results: Array<any> = [];

    for (const app of applications) {
      evaluated++;
      const candidate = app.candidate!;
      const candidateSkills = candidate.skills.map((s) => s.skill.name);
      let parsed: any = { skills: [], confidence: 0, emails: [], phones: [] };
      let resumeBuffer: Buffer | null = null;
      let resumeName = "";
      let resumeMime = "application/octet-stream";
      if (app.resumeFileId) {
        const stored = await prisma.storedFile.findUnique({ where: { id: app.resumeFileId } });
        if (stored) {
          try { resumeBuffer = await readStoredFile(stored); } catch {}
          resumeName = stored.originalName;
          resumeMime = stored.mimeType;
        }
      }
      const text = resumeBuffer ? await extractText(resumeBuffer, resumeMime, resumeName) : "";
      parsed = parseStructured(text, candidate.fullName);
      let extraction = await prisma.cvExtractionResult.findFirst({ where: { candidateId: candidate.id }, orderBy: { createdAt: "desc" } });
      if (!extraction && app.resumeFileId) {
        extraction = await prisma.cvExtractionResult.create({
          data: {
            fileId: app.resumeFileId,
            candidateId: candidate.id,
            status: text.trim().length ? "COMPLETED" : "NEEDS_REVIEW",
            confidence: parsed.confidence,
            data: parsed,
            rawText: text.slice(0, 200000),
          },
        });
      } else if (extraction?.data) {
        parsed = extraction.data;
      }

      const match = scoreMatch(
        { fullName: candidate.fullName, totalExperience: candidate.totalExperience, relevantExperience: candidate.relevantExperience, qualification: candidate.qualification, specialization: candidate.specialization },
        candidateSkills,
        parsed,
        { ...job, requiredSkills: job.requiredSkills, preferredSkills: job.preferredSkills, requiredCertifications: job.requiredCertifications },
        weights,
      );
      if (match.overallScore > topScore) topScore = match.overallScore;

      const saved = await prisma.candidateJobMatch.upsert({
        where: { candidateId_jobOpeningId: { candidateId: candidate.id, jobOpeningId } },
        update: {
          applicationId: app.id,
          overallScore: match.overallScore,
          skillScore: match.skillScore,
          experienceScore: match.experienceScore,
          qualificationScore: match.qualificationScore,
          domainScore: match.domainScore,
          certificationScore: match.certificationScore,
          matchedSkills: match.matchedSkills as any,
          missingSkills: match.missingSkills as any,
          strengths: match.strengths as any,
          gaps: match.gaps as any,
          explanation: match.explanation,
          extractionConfidence: match.extractionConfidence,
          weights: match.weights as any,
          computedById: req.auth!.subjectId,
          computedAt: new Date(),
        },
        create: {
          candidateId: candidate.id,
          jobOpeningId,
          applicationId: app.id,
          overallScore: match.overallScore,
          skillScore: match.skillScore,
          experienceScore: match.experienceScore,
          qualificationScore: match.qualificationScore,
          domainScore: match.domainScore,
          certificationScore: match.certificationScore,
          matchedSkills: match.matchedSkills as any,
          missingSkills: match.missingSkills as any,
          strengths: match.strengths as any,
          gaps: match.gaps as any,
          explanation: match.explanation,
          extractionConfidence: match.extractionConfidence,
          weights: match.weights as any,
          computedById: req.auth!.subjectId,
        },
        include: { candidate: true },
      });
      results.push(saved);
    }

    await prisma.aiScreeningRun.create({
      data: { jobOpeningId, createdById: req.auth!.subjectId, weights, candidatesEvaluated: evaluated, topScore: evaluated ? topScore : null },
    });
    await cache.applicationsChanged();
    await logAudit(req, { action: "AI_SCREENING_RUN", entityType: "JobOpening", entityId: jobOpeningId, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { candidatesEvaluated: evaluated, topScore } });

    return created(res, { run: { jobOpeningId, candidatesEvaluated: evaluated, topScore }, matches: results });
  }),
);

router.get(
  "/:jobOpeningId/ranked",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { jobOpeningId } = z.object({ jobOpeningId: z.string().min(1) }).parse(req.params);
    const { page, pageSize, skip, take } = getPagination(req);
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const where: any = { jobOpeningId };
    if (typeof minScore === "number") where.overallScore = { gte: minScore };
    const [items, total] = await Promise.all([
      prisma.candidateJobMatch.findMany({ where, skip, take, orderBy: { overallScore: "desc" }, include: { candidate: { include: { skills: { include: { skill: true } } } }, application: true } }),
      prisma.candidateJobMatch.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/:jobOpeningId/candidates/:candidateId",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { jobOpeningId, candidateId } = z.object({ jobOpeningId: z.string().min(1), candidateId: z.string().min(1) }).parse(req.params);
    const match = await prisma.candidateJobMatch.findFirst({
      where: { jobOpeningId, candidateId },
      include: { candidate: { include: { skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true } }, application: true },
    });
    if (!match) throw ApiError.notFound("No AI match found for this candidate and opening.");
    return ok(res, { match });
  }),
);

const actionSchema = z.object({ action: z.enum(["shortlist", "hold"]), remarks: z.string().optional().nullable() });

router.post(
  "/applications/:id/action",
  requirePermission("ai.run"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { action, remarks } = parsed.data;

    const app = await prisma.application.findUnique({ where: { id }, include: { candidate: true, jobOpening: { include: { department: true } } } });
    if (!app) throw ApiError.notFound("Application not found.");
    const allowed = APPLICATION_TRANSITIONS[app.status] ?? [];
    const target = action === "shortlist" ? APPLICATION_STATUS.SHORTLISTED : APPLICATION_STATUS.ON_HOLD;
    if (!allowed.includes(target)) throw ApiError.badRequest(`Cannot move application from ${app.status} to ${target}.`);

    const updated = await prisma.application.update({ where: { id }, data: { status: target, ...(remarks !== undefined ? { hrRemarks: remarks } : {}) } });
    await prisma.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: target, changedById: req.auth!.subjectId, remarks } });
    await logAudit(req, { action: `AI_${action.toUpperCase()}`, entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { from: app.status, to: target, remarks } });

    if (action === "shortlist") {
      void sendTemplateEmail({ to: app.candidate.email, templateKey: "candidate_shortlisted", data: { name: app.candidate.fullName, jobTitle: app.jobOpening.title, appUrl: env.appUrl } });
      await notifyCandidate(app.candidateId, { type: "application.shortlisted", title: "Shortlisted", body: `You have been shortlisted for ${app.jobOpening.title}.`, entityType: "Application", entityId: id });
      await notifyHrTeam({ type: "application.shortlisted", title: "Candidate shortlisted", body: `${app.candidate.fullName} shortlisted for ${app.jobOpening.title}.`, entityType: "Application", entityId: id, excludeUserId: req.auth!.subjectId });
    } else {
      await notifyCandidate(app.candidateId, { type: "application.on_hold", title: "Application on hold", body: `Your application for ${app.jobOpening.title} has been placed on hold.`, entityType: "Application", entityId: id });
    }
    return ok(res, { item: updated, label: APPLICATION_STATUS_LABELS[target] });
  }),
);

router.get(
  "/config",
  requirePermission("ai.view"),
  asyncHandler(async (_req, res) => {
    return ok(res, { weights: env.aiWeights, valid: env.aiWeightsValid, topRecommendations: env.aiTopRecommendations });
  }),
);

export default router;
