/**
 * CV screening engine.
 *
 * POST /run creates an AiScreeningJob and returns immediately. The worker below
 * evaluates candidates in the background, writing progress to that job row.
 * GET /jobs/:id is polled by the UI; GET /:jobOpeningId/kpis serves aggregates.
 * Scores are never invented: candidates without usable CV evidence are marked
 * FAILED and never enter the ranking.
 */
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
import { scoreMatch } from "../ai/scoring";
import { scoreMatchV2, SCORING_V2_WEIGHTS } from "../ai/scoringV2";
import { readStoredFile } from "../storage/index";
import { env } from "../config/env";
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, APPLICATION_TRANSITIONS } from "../config/constants";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const runSchema = z.object({
  jobOpeningId: z.string().min(1),
  includeInternal: z.coerce.boolean().optional().default(false),
  force: z.coerce.boolean().optional().default(false),
});

// Only candidates still in the early recruiting funnel are screening targets.
// Terminal/hired/later-stage applications must never be re-scored or ranked.
const SCREENABLE_STATUSES = ["APPLIED", "UNDER_REVIEW", "AI_RECOMMENDED"];

type JobOptions = { includeInternal: boolean; force: boolean };

/** In-process guard so this server never starts the same job twice. */
const activeJobs = new Set<string>();

/**
 * A restart leaves jobs in PENDING/PROCESSING forever. Fail only batches older
 * than 15 minutes so a job currently running in another server is not touched.
 */
async function recoverInterruptedJobs() {
  await prisma.aiScreeningJob.updateMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
    data: {
      status: "FAILED",
      error: "Screening was interrupted by a server restart. Please start a new batch.",
      finishedAt: new Date(),
    },
  });
}
void recoverInterruptedJobs().catch(() => undefined);

/**
 * Runs one screening batch in the background. Progress is written to the job
 * row after every candidate so the browser can poll GET /jobs/:id. Each candidate
 * is isolated in try/catch: one malformed CV never aborts the whole batch.
 */
async function processScreeningJob(jobId: string, actorId: string | null) {
  try {
    const job = await prisma.aiScreeningJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "PENDING") return;
    await prisma.aiScreeningJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    const options = (job.options as JobOptions | null) ?? { includeInternal: false, force: false };
    const jobOpeningId = job.jobOpeningId;
    const opening = await prisma.jobOpening.findUnique({
      where: { id: jobOpeningId },
      include: { department: true, program: true },
    });
    if (!opening) throw new Error("The job opening no longer exists.");

    const where: any = { jobOpeningId };
    if (!options.includeInternal) where.status = { in: SCREENABLE_STATUSES };
    const applications = await prisma.application.findMany({
      where,
      select: {
        id: true, candidateId: true, status: true, resumeFileId: true, appliedAt: true,
        candidate: {
          select: {
            id: true, fullName: true, totalExperience: true, relevantExperience: true,
            qualification: true, specialization: true, currentDesignation: true, currentOrganization: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        },
        resumeFile: {
          select: { id: true, originalName: true, mimeType: true, provider: true, storagePath: true, key: true },
        },
      },
      orderBy: { appliedAt: "desc" },
    });
    await prisma.aiScreeningJob.update({ where: { id: jobId }, data: { total: applications.length } });

    // Bulk-read prior results so already-evaluated candidates can be skipped in
    // one query instead of one query each.
    const priorMatches = await prisma.candidateJobMatch.findMany({
      where: { jobOpeningId, candidateId: { in: applications.map((a) => a.candidateId) } },
      select: { candidateId: true, overallScore: true },
    });
    const priorByCandidate = new Map(priorMatches.map((match) => [match.candidateId, match]));

    const weights = env.aiWeights;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let topScore = 0;

    for (const app of applications) {
      const candidate = app.candidate;
      const progress: Record<string, unknown> = { processed: { increment: 1 } };
      try {
        // Incremental runs: never pay for a candidate that already has a real
        // evaluation. `force=1` is an explicit request to re-evaluate everyone.
        const prior = priorByCandidate.get(candidate.id);
        if (!options.force && prior && prior.overallScore != null) {
          skipped++;
          progress.skipped = { increment: 1 };
          continue;
        }

        await prisma.application.update({
          where: { id: app.id },
          data: { screeningStatus: "PROCESSING", screeningError: null },
        });

        // Reuse a completed extraction for this exact CV file. Downloading and
        // OCR-ing an unchanged CV on every run was the main latency problem.
        let parsed: any = { skills: [], confidence: 0, emails: [], phones: [], certifications: [], organizations: [], titles: [], projects: [] };
        let text = "";
        if (app.resumeFileId) {
          const extraction = await prisma.cvExtractionResult.findFirst({
            where: { fileId: app.resumeFileId },
            select: { id: true, status: true, data: true, rawText: true },
            orderBy: { createdAt: "desc" },
          });
          if (extraction?.status === "COMPLETED" && extraction.data) {
            parsed = extraction.data as any;
            text = (extraction.rawText as string) ?? "";
          } else {
            let buffer: Buffer | null = null;
            const stored = app.resumeFile;
            if (stored) {
              try { buffer = await readStoredFile(stored); } catch { /* fall back to profile-only evidence */ }
            }
            text = buffer ? await extractText(buffer, stored?.mimeType ?? "application/octet-stream", stored?.originalName ?? "resume") : "";
            parsed = parseStructured(text, candidate.fullName);
            const payload = {
              status: text.trim().length ? "COMPLETED" : "NEEDS_REVIEW",
              confidence: parsed.confidence ?? 0,
              data: parsed,
              rawText: text.slice(0, 200000),
              error: null,
            };
            if (extraction) await prisma.cvExtractionResult.update({ where: { id: extraction.id }, data: payload });
            else await prisma.cvExtractionResult.create({ data: { fileId: app.resumeFileId, candidateId: candidate.id, ...payload } });
          }
        }

        const candidateSkills = candidate.skills.map((s) => s.skill.name);
        const profile = {
          fullName: candidate.fullName,
          totalExperience: candidate.totalExperience,
          relevantExperience: candidate.relevantExperience,
          qualification: candidate.qualification,
          specialization: candidate.specialization,
        };
        const match = scoreMatch(profile, candidateSkills, parsed, opening, weights);
        const matchV2 = env.aiScoringVersion === "v2"
          ? scoreMatchV2(
              { ...profile, skills: candidateSkills, titles: [candidate.currentDesignation].filter(Boolean) as string[], organizations: [candidate.currentOrganization].filter(Boolean) as string[] },
              parsed,
              {
                title: opening.title, description: opening.description, departmentName: opening.department?.name,
                requiredSkills: opening.requiredSkills, preferredSkills: opening.preferredSkills, requiredCertifications: opening.requiredCertifications,
                minExperience: opening.minExperience, maxExperience: opening.maxExperience,
                relevantExperience: opening.relevantExperience, requiredQualification: opening.requiredQualification,
              },
            )
          : null;

        // Never invent a score. Without CV evidence, or when V2 explicitly reports
        // insufficient information, persist no score and mark the item FAILED so
        // it cannot appear as "evaluated" or enter the ranking.
        const insufficient = !text.trim()
          || (matchV2 != null && (matchV2.overallScore == null || matchV2.recommendation === "INSUFFICIENT_INFORMATION"));
        if (insufficient) {
          await prisma.application.update({
            where: { id: app.id },
            data: { aiMatchScore: null, screeningStatus: "FAILED", screeningError: "Insufficient CV evidence for a reliable evaluation." },
          });
          failed++;
          progress.failed = { increment: 1 };
          continue;
        }

        const effectiveScore = matchV2 ? (matchV2.overallScore ?? match.overallScore) : match.overallScore;
        const allowsPromotion = !matchV2
          || (matchV2.missingMandatorySkills.length === 0
            && matchV2.recommendation !== "MANUAL_REVIEW_REQUIRED"
            && matchV2.recommendation !== "INSUFFICIENT_INFORMATION");
        if (effectiveScore > topScore) topScore = effectiveScore;

        const dimensionScore = (name: string, fallback: number): number =>
          matchV2?.dimensions.find((item) => item.dimension === name)?.score ?? fallback;
        const promotesToRecommended = effectiveScore >= 70 && app.status === "UNDER_REVIEW" && allowsPromotion;
        await prisma.application.update({
          where: { id: app.id },
          data: {
            aiMatchScore: effectiveScore, screeningStatus: "EVALUATED", screeningError: null,
            ...(promotesToRecommended ? { status: "AI_RECOMMENDED" as any } : {}),
          },
        });
        if (promotesToRecommended) {
          await prisma.applicationStatusHistory.create({
            data: { applicationId: app.id, fromStatus: "UNDER_REVIEW", toStatus: "AI_RECOMMENDED", changedById: actorId, remarks: `AI screening recommended this candidate (score ${effectiveScore}%).` },
          });
        }

        const v2Fields = matchV2 ? {
          scoringVersion: matchV2.scoringVersion,
          projectScore: dimensionScore("project", match.domainScore),
          roleScore: dimensionScore("role", match.domainScore),
          dimensionScores: matchV2.dimensions as any,
          recommendation: matchV2.recommendation,
          dataCompleteness: matchV2.dataCompleteness,
          evidence: {
            matchedSkills: matchV2.matchedSkills,
            missingMandatorySkills: matchV2.missingMandatorySkills,
            relatedSkills: matchV2.relatedSkills,
            explanation: matchV2.explanation,
          } as any,
        } : { scoringVersion: "v1" };
        const scoreFields = {
          applicationId: app.id,
          overallScore: effectiveScore,
          skillScore: dimensionScore("skills", match.skillScore),
          experienceScore: dimensionScore("experience", match.experienceScore),
          qualificationScore: dimensionScore("qualification", match.qualificationScore),
          domainScore: dimensionScore("project", match.domainScore),
          certificationScore: dimensionScore("certification", match.certificationScore),
          matchedSkills: (matchV2?.matchedSkills ?? match.matchedSkills) as any,
          missingSkills: (matchV2?.missingMandatorySkills ?? match.missingSkills) as any,
          strengths: match.strengths as any,
          gaps: match.gaps as any,
          explanation: matchV2?.explanation ?? match.explanation,
          extractionConfidence: match.extractionConfidence,
          weights: (matchV2 ? SCORING_V2_WEIGHTS : match.weights) as any,
          computedById: actorId,
          computedAt: new Date(),
          ...v2Fields,
        };
        await prisma.candidateJobMatch.upsert({
          where: { candidateId_jobOpeningId: { candidateId: candidate.id, jobOpeningId } },
          update: scoreFields,
          create: { candidateId: candidate.id, jobOpeningId, ...scoreFields },
        });
        if (matchV2) {
          const saved = await prisma.candidateJobMatch.findUnique({
            where: { candidateId_jobOpeningId: { candidateId: candidate.id, jobOpeningId } },
            select: { id: true },
          });
          if (saved) {
            await prisma.aiMatchEvidence.deleteMany({ where: { candidateJobMatchId: saved.id } });
            if (matchV2.dimensions.length > 0) {
              await prisma.aiMatchEvidence.createMany({
                data: matchV2.dimensions.map((item) => ({
                  candidateJobMatchId: saved.id,
                  dimension: item.dimension,
                  score: item.score,
                  applicability: item.applicability,
                  weight: item.weight,
                  evidence: item.evidence as any,
                  reason: item.reason,
                })),
              });
            }
          }
        }
        succeeded++;
        progress.succeeded = { increment: 1 };
      } catch (error) {
        // One malformed CV must never abort the whole batch. Record the failure
        // on that application and keep processing the remaining candidates.
        failed++;
        progress.failed = { increment: 1 };
        const message = error instanceof Error ? error.message : "Unknown screening error";
        try {
          await prisma.application.update({
            where: { id: app.id },
            data: { aiMatchScore: null, screeningStatus: "FAILED", screeningError: message.slice(0, 2000) },
          });
        } catch { /* never let a status write hide the original error */ }
      } finally {
        if (topScore > 0) progress.topScore = topScore;
        await prisma.aiScreeningJob.update({ where: { id: jobId }, data: progress }).catch(() => undefined);
      }
    }

    await prisma.aiScreeningRun.create({
      data: { jobOpeningId, createdById: actorId, weights, candidatesEvaluated: succeeded, topScore: succeeded ? topScore : null },
    });
    await cache.applicationsChanged();
    await prisma.aiScreeningJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED", finishedAt: new Date(), processed: applications.length,
        succeeded, failed, skipped, topScore: succeeded ? topScore : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screening failed.";
    await prisma.aiScreeningJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message.slice(0, 2000), finishedAt: new Date() },
    }).catch(() => undefined);
  } finally {
    activeJobs.delete(jobId);
  }
}

router.post(
  "/run",
  requirePermission("ai.run"),
  asyncHandler(async (req, res) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { jobOpeningId, includeInternal, force } = parsed.data;

    const opening = await prisma.jobOpening.findUnique({
      where: { id: jobOpeningId },
      select: { id: true, title: true },
    });
    if (!opening) throw ApiError.notFound("Job opening not found.");

    // Only one active batch per opening. Return the existing job so the UI can
    // simply keep polling instead of showing a confusing error.
    const active = await prisma.aiScreeningJob.findFirst({
      where: { jobOpeningId, status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      return ok(res, { jobId: active.id, job: active, message: "A screening batch is already running for this opening." });
    }

    const job = await prisma.aiScreeningJob.create({
      data: {
        jobOpeningId,
        createdById: req.auth!.subjectId,
        status: "PENDING",
        options: { includeInternal, force } as any,
      },
    });
    await logAudit(req, {
      action: "AI_SCREENING_RUN_STARTED", entityType: "JobOpening", entityId: jobOpeningId,
      actorId: req.auth!.subjectId, actorEmail: req.auth!.email,
      metadata: { jobId: job.id, includeInternal, force },
    });

    // Return immediately; evaluation continues in the background.
    setImmediate(() => {
      if (activeJobs.has(job.id)) return;
      activeJobs.add(job.id);
      void processScreeningJob(job.id, req.auth!.subjectId);
    });
    return created(res, { jobId: job.id, job, message: "Screening started. Poll /jobs/:id for progress." });
  }),
);

router.get(
  "/jobs/:id",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const job = await prisma.aiScreeningJob.findUnique({ where: { id } });
    if (!job) throw ApiError.notFound("Screening job not found.");
    return ok(res, { job });
  }),
);

router.get(
  "/:jobOpeningId/jobs",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { jobOpeningId } = z.object({ jobOpeningId: z.string().min(1) }).parse(req.params);
    const { page, pageSize, skip, take } = getPagination(req, 10, 50);
    const [items, total] = await Promise.all([
      prisma.aiScreeningJob.findMany({ where: { jobOpeningId }, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.aiScreeningJob.count({ where: { jobOpeningId } }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
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
      prisma.candidateJobMatch.findMany({ where, skip, take, orderBy: { overallScore: "desc" }, include: { candidate: { include: { skills: { include: { skill: true } } } }, application: true, evidenceRecords: { orderBy: { createdAt: "asc" } } } }),
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
      include: { candidate: { include: { skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true } }, application: true, evidenceRecords: { orderBy: { createdAt: "asc" } } },
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
  "/:jobOpeningId/kpis",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { jobOpeningId } = z.object({ jobOpeningId: z.string().min(1) }).parse(req.params);
    const where = { jobOpeningId, status: { in: SCREENABLE_STATUSES } };
    const [statusGroups, scored] = await Promise.all([
      prisma.application.groupBy({ by: ["screeningStatus"], where, _count: { _all: true } }),
      prisma.application.count({ where: { ...where, aiMatchScore: { not: null } } }),
    ]);
    const counts: Record<string, number> = { pending: 0, processing: 0, evaluated: 0, failed: 0 };
    for (const group of statusGroups) {
      const key = (group.screeningStatus ?? "PENDING").toLowerCase();
      counts[key in counts ? key : "pending"] += group._count._all;
    }
    // The score is the source of truth for "evaluated" so legacy rows (which have
    // no status column value yet) are still counted correctly.
    counts.evaluated = scored;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return ok(res, { kpis: { ...counts, total } });
  }),
);

router.get(
  "/config",
  requirePermission("ai.view"),
  asyncHandler(async (_req, res) => {
    return ok(res, { weights: env.aiWeights, valid: env.aiWeightsValid, topRecommendations: env.aiTopRecommendations });
  }),
);

const decisionSchema = z.object({
  decision: z.enum(["SHORTLISTED", "ON_HOLD", "REJECTED", "REMARKS", "MANUAL_REVIEW"]),
  remarks: z.string().optional().nullable(),
  overrideReason: z.string().optional().nullable(),
});

router.post(
  "/applications/:id/decision",
  requirePermission("ai.run"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid screening decision.", parsed.error.flatten());
    const { decision, remarks, overrideReason } = parsed.data;
    if (["ON_HOLD", "REJECTED"].includes(decision) && !remarks?.trim()) {
      throw ApiError.badRequest("A reason is required for on-hold and rejection decisions.");
    }
    const app = await prisma.application.findUnique({
      where: { id },
      include: { candidate: true, jobOpening: { include: { department: true } } },
    });
    if (!app) throw ApiError.notFound("Application not found.");
    const match = await prisma.candidateJobMatch.findFirst({
      where: { candidateId: app.candidateId, jobOpeningId: app.jobOpeningId },
    });
    const statusDecision = ["SHORTLISTED", "ON_HOLD", "REJECTED"].includes(decision);
    if (statusDecision) {
      const allowed = APPLICATION_TRANSITIONS[app.status] ?? [];
      if (!allowed.includes(decision as any)) throw ApiError.badRequest(`Cannot move application from ${app.status} to ${decision}.`);
      await prisma.application.update({
        where: { id },
        data: { status: decision, ...(remarks !== undefined ? { hrRemarks: remarks } : {}) },
      });
      await prisma.applicationStatusHistory.create({
        data: { applicationId: id, fromStatus: app.status, toStatus: decision, changedById: req.auth!.subjectId, remarks: remarks ?? overrideReason ?? null },
      });
    } else if (remarks?.trim()) {
      await prisma.applicationRemark.create({ data: { applicationId: id, authorId: req.auth!.subjectId, body: remarks.trim() } });
    }
    const saved = await prisma.screeningDecision.create({
      data: {
        applicationId: id,
        candidateId: app.candidateId,
        jobOpeningId: app.jobOpeningId,
        decision,
        previousRecommendation: match?.recommendation ?? null,
        overrideReason: overrideReason?.trim() || null,
        remarks: remarks?.trim() || null,
        decidedById: req.auth!.subjectId,
        scoringVersion: match?.scoringVersion ?? null,
      },
    });
    await logAudit(req, {
      action: "AI_SCREENING_DECISION",
      entityType: "ScreeningDecision",
      entityId: saved.id,
      actorId: req.auth!.subjectId,
      actorEmail: req.auth!.email,
      metadata: { applicationId: id, decision, previousRecommendation: saved.previousRecommendation, overrideReason: saved.overrideReason },
    });
    if (decision === "SHORTLISTED") {
      void sendTemplateEmail({ to: app.candidate.email, templateKey: "candidate_shortlisted", data: { name: app.candidate.fullName, jobTitle: app.jobOpening.title, appUrl: env.appUrl } });
      await notifyCandidate(app.candidateId, { type: "application.shortlisted", title: "Shortlisted", body: `You have been shortlisted for ${app.jobOpening.title}.`, entityType: "Application", entityId: id });
      await notifyHrTeam({ type: "application.shortlisted", title: "Candidate shortlisted", body: `${app.candidate.fullName} shortlisted for ${app.jobOpening.title}.`, entityType: "Application", entityId: id, excludeUserId: req.auth!.subjectId });
    }
    await cache.applicationsChanged();
    return created(res, { item: saved, message: "HR screening decision recorded." });
  }),
);

router.get(
  "/applications/:id/decisions",
  requirePermission("ai.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const decisions = await prisma.screeningDecision.findMany({ where: { applicationId: id }, orderBy: { decidedAt: "desc" } });
    return ok(res, { decisions });
  }),
);

export default router;
