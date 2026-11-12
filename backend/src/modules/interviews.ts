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
import { env } from "../config/env";
import { APPLICATION_STATUS, APPLICATION_TRANSITIONS, APPLICATION_STATUS_LABELS } from "../config/constants";
import { INTERVIEW_STATUS, INTERVIEW_RESULT, INTERVIEW_MODES } from "../config/constants";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const interviewSchema = z.object({
  applicationId: z.string().min(1),
  round: z.string().min(1).default("Technical Round 1"),
  scheduledAt: z.coerce.date(),
  timezone: z.string().default("Asia/Kolkata"),
  mode: z.enum(["ONLINE", "OFFLINE", "PHONE"]).default("ONLINE"),
  location: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal("")),
  interviewerName: z.string().min(1),
  interviewerEmail: z.string().email().optional().nullable(),
  instructions: z.string().optional().nullable(),
  internalRemarks: z.string().optional().nullable(),
});

router.get(
  "/",
  requirePermission("interviews.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.applicationId) where.applicationId = String(req.query.applicationId);
    if (req.query.interviewerEmail) where.interviewerEmail = { contains: String(req.query.interviewerEmail), mode: "insensitive" };
    if (search) where.OR = [{ interviewerName: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      prisma.interview.findMany({
        where, skip, take, orderBy: { scheduledAt: "asc" },
        include: { application: { include: { candidate: true, jobOpening: { include: { department: true } } } }, feedback: true },
      }),
      prisma.interview.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/:id",
  requirePermission("interviews.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.interview.findUnique({
      where: { id },
      include: { application: { include: { candidate: true, jobOpening: true } }, feedback: true },
    });
    if (!item) throw ApiError.notFound("Interview not found.");
    return ok(res, { item });
  }),
);

router.post(
  "/",
  requirePermission("interviews.manage"),
  asyncHandler(async (req, res) => {
    const parsed = interviewSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { applicationId, scheduledAt, ...rest } = parsed.data;
    const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { candidate: true, jobOpening: true } });
    if (!app) throw ApiError.notFound("Application not found.");
    const allowed = APPLICATION_TRANSITIONS[app.status] ?? [];
    if (!allowed.includes(APPLICATION_STATUS.INTERVIEW_SCHEDULED)) throw ApiError.badRequest("Application must be shortlisted before scheduling an interview.");
    const interview = await prisma.interview.create({
      data: { applicationId, scheduledAt, ...rest, status: INTERVIEW_STATUS.SCHEDULED, result: INTERVIEW_RESULT.PENDING },
      include: { application: { include: { candidate: true } } },
    });
    await prisma.application.update({ where: { id: applicationId }, data: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } });
    await prisma.applicationStatusHistory.create({ data: { applicationId, fromStatus: app.status, toStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED, changedById: req.auth!.subjectId, remarks: "Interview scheduled" } });
    void sendTemplateEmail({ to: app.candidate.email, templateKey: "interview_scheduled", data: { name: app.candidate.fullName, jobTitle: app.jobOpening.title, round: rest.round, scheduledAt: scheduledAt.toISOString(), timezone: rest.timezone, mode: rest.mode, location: rest.location, meetingLink: rest.meetingLink, interviewerName: rest.interviewerName, instructions: rest.instructions, appUrl: env.appUrl } });
    if (rest.interviewerEmail) void sendTemplateEmail({ to: rest.interviewerEmail, templateKey: "interview_scheduled", data: { name: rest.interviewerName, jobTitle: app.jobOpening.title, round: rest.round, scheduledAt: scheduledAt.toISOString(), timezone: rest.timezone, mode: rest.mode, location: rest.location, meetingLink: rest.meetingLink, interviewerName: rest.interviewerName, instructions: rest.instructions, appUrl: env.appUrl } });
    await notifyCandidate(app.candidateId, { type: "interview.scheduled", title: "Interview scheduled", body: `Interview for ${app.jobOpening.title} scheduled on ${scheduledAt.toISOString()}.`, entityType: "Interview", entityId: interview.id });
    await notifyHrTeam({ type: "interview.scheduled", title: "Interview scheduled", body: `${app.candidate.fullName} - ${app.jobOpening.title}`, entityType: "Interview", entityId: interview.id, excludeUserId: req.auth!.subjectId });
    await logAudit(req, { action: "INTERVIEW_CREATE", entityType: "Interview", entityId: interview.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { item: interview });
  }),
);

router.patch(
  "/:id",
  requirePermission("interviews.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const update = z.object({ scheduledAt: z.coerce.date().optional(), timezone: z.string().optional(), mode: z.enum(["ONLINE","OFFLINE","PHONE"]).optional(), location: z.string().optional().nullable(), meetingLink: z.string().url().optional().nullable().or(z.literal("")), interviewerName: z.string().optional(), interviewerEmail: z.string().email().optional().nullable(), instructions: z.string().optional().nullable(), status: z.enum(["SCHEDULED","RESCHEDULED","COMPLETED","CANCELLED"]).optional() }).safeParse(req.body);
    if (!update.success) throw ApiError.badRequest("Invalid input.", update.error.flatten());
    const item = await prisma.interview.findUnique({ where: { id }, include: { application: { include: { candidate: true, jobOpening: true } } } });
    if (!item) throw ApiError.notFound("Interview not found.");
    const data: Record<string, unknown> = {};
    for (const k of ["scheduledAt","timezone","mode","location","meetingLink","interviewerName","interviewerEmail","instructions"] as const) {
      if (update.data[k] !== undefined) data[k] = update.data[k];
    }
    if (update.data.status) data.status = update.data.status;
    const updated = await prisma.interview.update({ where: { id }, data });
    if (update.data.status === "RESCHEDULED") {
      void sendTemplateEmail({ to: item.application.candidate.email, templateKey: "interview_rescheduled", data: { name: item.application.candidate.fullName, jobTitle: item.application.jobOpening.title, round: item.round, scheduledAt: item.scheduledAt.toISOString(), timezone: item.timezone, mode: item.mode, interviewerName: item.interviewerName, appUrl: env.appUrl } });
    }
    await logAudit(req, { action: "INTERVIEW_UPDATE", entityType: "Interview", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.post(
  "/:id/cancel",
  requirePermission("interviews.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ reason: z.string().optional().nullable() }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("Invalid input.", body.error.flatten());
    const item = await prisma.interview.findUnique({ where: { id }, include: { application: { include: { candidate: true, jobOpening: true } } } });
    if (!item) throw ApiError.notFound("Interview not found.");
    await prisma.interview.update({ where: { id }, data: { status: INTERVIEW_STATUS.CANCELLED } });
    void sendTemplateEmail({ to: item.application.candidate.email, templateKey: "interview_cancelled", data: { name: item.application.candidate.fullName, jobTitle: item.application.jobOpening.title, reason: body.data.reason, appUrl: env.appUrl } });
    await logAudit(req, { action: "INTERVIEW_CANCEL", entityType: "Interview", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "Interview cancelled." });
  }),
);

const feedbackSchema = z.object({ interviewerName: z.string().optional(), score: z.coerce.number().min(0).max(100).optional().nullable(), feedback: z.string().optional().nullable(), recommendation: z.string().optional().nullable() });

router.post(
  "/:id/feedback",
  requirePermission("interviews.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const interview = await prisma.interview.findUnique({ where: { id }, include: { application: true } });
    if (!interview) throw ApiError.notFound("Interview not found.");
    const feedback = await prisma.interviewFeedback.create({ data: { interviewId: id, ...parsed.data, submittedAt: new Date() } });
    await prisma.interview.update({ where: { id }, data: { status: INTERVIEW_STATUS.COMPLETED } });
    await logAudit(req, { action: "INTERVIEW_FEEDBACK", entityType: "InterviewFeedback", entityId: feedback.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { feedback });
  }),
);

const resultSchema = z.object({
  result: z.enum(["SELECTED", "REJECTED", "ON_HOLD", "NEXT_ROUND", "UNDER_REVIEW"]),
  remarks: z.string().optional().nullable(),
  nextRound: z.string().optional().nullable(),
  nextScheduledAt: z.coerce.date().optional().nullable(),
});

router.post(
  "/:id/result",
  requirePermission("interviews.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = resultSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { result, remarks, nextRound, nextScheduledAt } = parsed.data;
    const interview = await prisma.interview.findUnique({ where: { id }, include: { application: { include: { candidate: true, jobOpening: true } } } });
    if (!interview) throw ApiError.notFound("Interview not found.");
    await prisma.interview.update({ where: { id }, data: { status: INTERVIEW_STATUS.COMPLETED, result } });
    let targetStatus: typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];
    switch (result) {
      case INTERVIEW_RESULT.SELECTED: targetStatus = APPLICATION_STATUS.SELECTED; break;
      case INTERVIEW_RESULT.REJECTED: targetStatus = APPLICATION_STATUS.REJECTED; break;
      case INTERVIEW_RESULT.ON_HOLD: targetStatus = APPLICATION_STATUS.ON_HOLD; break;
      case "UNDER_REVIEW": targetStatus = APPLICATION_STATUS.UNDER_REVIEW; break;
      default: targetStatus = APPLICATION_STATUS.INTERVIEW_COMPLETED; break;
    }
    const allowed = APPLICATION_TRANSITIONS[interview.application.status] ?? [];
    if (!allowed.includes(targetStatus)) throw ApiError.badRequest(`Cannot move application from ${interview.application.status} to ${targetStatus}.`);
    const updated = await prisma.application.update({ where: { id: interview.applicationId }, data: { status: targetStatus, ...(remarks !== undefined ? { hrRemarks: remarks } : {}) } });
    await prisma.applicationStatusHistory.create({ data: { applicationId: interview.applicationId, fromStatus: interview.application.status, toStatus: targetStatus, changedById: req.auth!.subjectId, remarks } });
    // Moving the candidate forward schedules the following round automatically.
    let nextInterview = null;
    if (result === "NEXT_ROUND") {
      const scheduledAt = nextScheduledAt ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const nextNumber = Number(interview.round.match(/\d+/)?.[0] || 1) + 1;
      nextInterview = await prisma.interview.create({
        data: {
          applicationId: interview.applicationId,
          round: nextRound || `Round ${nextNumber}`,
          scheduledAt,
          timezone: interview.timezone,
          mode: interview.mode,
          location: interview.location,
          meetingLink: interview.meetingLink,
          interviewerName: interview.interviewerName,
          interviewerEmail: interview.interviewerEmail,
          instructions: interview.instructions,
          status: INTERVIEW_STATUS.SCHEDULED,
          result: INTERVIEW_RESULT.PENDING,
          createdById: req.auth!.subjectId,
        },
      });
      await prisma.application.update({ where: { id: interview.applicationId }, data: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } });
      await prisma.applicationStatusHistory.create({ data: { applicationId: interview.applicationId, fromStatus: targetStatus, toStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED, changedById: req.auth!.subjectId, remarks: `Next round scheduled: ${nextInterview.round}` } });
      void sendTemplateEmail({
        to: interview.application.candidate.email,
        templateKey: "interview_scheduled",
        data: {
          name: interview.application.candidate.fullName,
          jobTitle: interview.application.jobOpening.title,
          round: nextInterview.round,
          scheduledAt: scheduledAt.toISOString(),
          timezone: interview.timezone,
          mode: interview.mode,
          location: interview.location,
          meetingLink: interview.meetingLink,
          interviewerName: interview.interviewerName,
          instructions: interview.instructions,
          appUrl: env.appUrl,
        },
      });
    } else if (result === "UNDER_REVIEW") {
      void sendTemplateEmail({
        to: interview.application.candidate.email,
        templateKey: "hr_notification",
        data: {
          title: "Your application is under review",
          message: `Your application for ${interview.application.jobOpening.title} is under review after the interview. HR will update you shortly.`,
          link: env.appUrl,
        },
      });
    } else {
      void sendTemplateEmail({
        to: interview.application.candidate.email,
        templateKey: result === INTERVIEW_RESULT.SELECTED ? "candidate_selected" : result === INTERVIEW_RESULT.REJECTED ? "candidate_rejected" : "hr_notification",
        data: { name: interview.application.candidate.fullName, jobTitle: interview.application.jobOpening.title, reason: remarks, appUrl: env.appUrl },
      });
    }
    await notifyCandidate(interview.application.candidateId, { type: "interview.result", title: "Interview result", body: `Result for ${interview.application.jobOpening.title}: ${result}.`, entityType: "Application", entityId: interview.applicationId });
    await notifyHrTeam({ type: "interview.result", title: "Interview result", body: `${interview.application.candidate.fullName} - ${result}`, entityType: "Application", entityId: interview.applicationId, excludeUserId: req.auth!.subjectId });
    await cache.applicationsChanged();
    await logAudit(req, { action: "INTERVIEW_RESULT", entityType: "Application", entityId: interview.applicationId, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { result, targetStatus } });
    return ok(res, { item: updated, label: APPLICATION_STATUS_LABELS[targetStatus], nextInterview });
  }),
);

export default router;
