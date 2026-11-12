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
import { cached, CACHE_KEYS } from "../lib/cache";
import { env } from "../config/env";
import { notifyHrTeam, notifyCandidate } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { APPLICATION_STATUS, APPLICATION_TRANSITIONS, APPLICATION_STATUS_LABELS } from "../config/constants";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const statusSchema = z.object({
  status: z.nativeEnum(APPLICATION_STATUS),
  remarks: z.string().optional().nullable(),
});

router.get(
  "/",
  requirePermission("applications.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.jobOpeningId) where.jobOpeningId = String(req.query.jobOpeningId);
    if (req.query.candidateId) where.candidateId = String(req.query.candidateId);
    if (req.query.departmentId) where.jobOpening = { departmentId: String(req.query.departmentId) };
    // Department-scoped HR roles (e.g. Department Manager) only see their departments.
    const scope = departmentScope(req.auth);
    if (scope !== null) {
      const scoped = { departmentId: { in: scope } };
      where.jobOpening = where.jobOpening ? { AND: [where.jobOpening, scoped] } : scoped;
    }
    if (search) {
      where.OR = [
        { applicationCode: { contains: search, mode: "insensitive" } },
        { candidate: { fullName: { contains: search, mode: "insensitive" } } },
        { candidate: { email: { contains: search, mode: "insensitive" } } },
        { candidate: { mobile: { contains: search, mode: "insensitive" } } },
        { jobOpening: { title: { contains: search, mode: "insensitive" } } },
      ];
    }
    const filterKey = [
      req.query.jobOpeningId ?? "-", req.query.status ?? "-", search ?? "-", req.query.departmentId ?? "-",
    ].join("|");
    const [items, total] = await Promise.all([
      cached(CACHE_KEYS.applicationsList(page, pageSize, filterKey), env.cacheTtlSeconds, async () =>
        prisma.application.findMany({
          where, skip, take, orderBy: { appliedAt: "desc" },
          include: { candidate: true, jobOpening: { include: { department: true } }, resumeFile: true, statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 10 } },
        }),
      ),
      prisma.application.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/:id",
  requirePermission("applications.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.application.findUnique({
      where: { id },
      include: {
        candidate: { include: { skills: { include: { skill: true } }, cvFile: true } },
        jobOpening: { include: { department: true } },
        resumeFile: true,
        statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "desc" } },
        remarks: { include: { author: true }, orderBy: { createdAt: "desc" } },
        interviews: { include: { feedback: true }, orderBy: { scheduledAt: "desc" } },
        offer: true,
        documents: { include: { category: true, file: true } },
        matches: true,
      },
    });
    if (!item) throw ApiError.notFound("Application not found.");
    return ok(res, { item });
  }),
);

router.patch(
  "/:id/status",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { status, remarks } = parsed.data;

    const app = await prisma.application.findUnique({ where: { id }, include: { candidate: true, jobOpening: { include: { department: true } } } });
    if (!app) throw ApiError.notFound("Application not found.");
    const allowed = APPLICATION_TRANSITIONS[app.status] ?? [];
    if (!allowed.includes(status)) throw ApiError.badRequest(`Cannot move application from ${app.status} to ${status}.`);

    const prev = app.status;
    const [updated] = await Promise.all([
      prisma.application.update({ where: { id }, data: { status, ...(remarks !== undefined ? { hrRemarks: remarks } : {}) }, include: { candidate: true, jobOpening: true } }),
      prisma.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: prev, toStatus: status, changedById: req.auth!.subjectId, remarks } }),
    ]);
    await cache.applicationsChanged();

    const candidateEmail = app.candidate.email;
    const candidateName = app.candidate.fullName;
    const jobTitle = app.jobOpening.title;

    const notifications: Promise<unknown>[] = [
      logAudit(req, { action: "APPLICATION_STATUS_CHANGE", entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { from: prev, to: status, remarks } }),
    ];

    switch (status) {
      case APPLICATION_STATUS.SHORTLISTED:
        void sendTemplateEmail({ to: candidateEmail, templateKey: "candidate_shortlisted", data: { name: candidateName, jobTitle, appUrl: env.appUrl } });
        notifications.push(notifyCandidate(app.candidateId, { type: "application.shortlisted", title: "Shortlisted", body: `You have been shortlisted for ${jobTitle}.`, entityType: "Application", entityId: id }));
        notifications.push(notifyHrTeam({ type: "application.shortlisted", title: "Candidate shortlisted", body: `${candidateName} shortlisted for ${jobTitle}.`, entityType: "Application", entityId: id, excludeUserId: req.auth!.subjectId }));
        break;
      case APPLICATION_STATUS.REJECTED:
        void sendTemplateEmail({ to: candidateEmail, templateKey: "candidate_rejected", data: { name: candidateName, jobTitle, reason: remarks, link: env.appUrl } });
        notifications.push(notifyCandidate(app.candidateId, { type: "application.rejected", title: "Application update", body: `Your application for ${jobTitle} was not progressed.`, entityType: "Application", entityId: id }));
        break;
      case APPLICATION_STATUS.SELECTED:
        void sendTemplateEmail({ to: candidateEmail, templateKey: "candidate_selected", data: { name: candidateName, jobTitle } });
        notifications.push(notifyCandidate(app.candidateId, { type: "application.selected", title: "Selected", body: `You have been selected for ${jobTitle}.`, entityType: "Application", entityId: id }));
        notifications.push(notifyHrTeam({ type: "application.selected", title: "Candidate selected", body: `${candidateName} selected for ${jobTitle}.`, entityType: "Application", entityId: id, excludeUserId: req.auth!.subjectId }));
        break;
      case APPLICATION_STATUS.ON_HOLD:
        void sendTemplateEmail({ to: candidateEmail, templateKey: "hr_notification", data: { title: "Application on hold", message: `Your application for ${jobTitle} has been placed on hold. ${remarks ?? ""}`, link: env.appUrl } });
        break;
      case APPLICATION_STATUS.HIRED:
        void sendTemplateEmail({ to: candidateEmail, templateKey: "hr_notification", data: { title: "Welcome to EMC", message: `Congratulations ${candidateName}, you have been hired for ${jobTitle}. HR will contact you for onboarding.`, link: env.appUrl } });
        break;
    }
    await Promise.allSettled(notifications);
    return ok(res, { item: updated, label: APPLICATION_STATUS_LABELS[status] });
  }),
);

const remarkSchema = z.object({ body: z.string().min(1) });

router.post(
  "/:id/remarks",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = remarkSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("remarks body is required.", parsed.error.flatten());
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw ApiError.notFound("Application not found.");
    const remark = await prisma.applicationRemark.create({ data: { applicationId: id, authorId: req.auth!.subjectId, body: parsed.data.body }, include: { author: true } });
    await logAudit(req, { action: "APPLICATION_REMARK", entityType: "ApplicationRemark", entityId: remark.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { remark });
  }),
);

router.get(
  "/:id/history",
  requirePermission("applications.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: id }, include: { changedBy: true }, orderBy: { createdAt: "desc" } });
    return ok(res, { history });
  }),
);

export default router;
