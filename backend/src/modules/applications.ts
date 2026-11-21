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

// Normalise blank/null salary values to null instead of letting
// z.coerce.number() turn null into 0.
const optionalSalary = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? null : Number(value)),
  z.number().nonnegative().nullable(),
);

const statusSchema = z.object({
  status: z.nativeEnum(APPLICATION_STATUS),
  remarks: z.string().optional().nullable(),
  finalSelectionSalary: optionalSalary.optional(),
  finalSelectionExpectedSalary: optionalSalary.optional(),
  finalSelectionNote: z.string().max(500).optional().nullable(),
});

router.get(
  "/",
  requirePermission("applications.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req, 20, 500);
    const where: any = {};
    // Allow a single status or a comma-separated list so queue screens can fetch
    // every stage they need in one request instead of one request per status.
    const statuses = typeof req.query.status === "string"
      ? req.query.status.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };
    if (req.query.jobOpeningId) where.jobOpeningId = String(req.query.jobOpeningId);
    if (req.query.candidateId) where.candidateId = String(req.query.candidateId);
    const dateFrom = typeof req.query.dateFrom === "string" && req.query.dateFrom ? new Date(`${req.query.dateFrom}T00:00:00.000Z`) : null;
    const dateTo = typeof req.query.dateTo === "string" && req.query.dateTo ? new Date(`${req.query.dateTo}T00:00:00.000Z`) : null;
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) where.appliedAt = { ...(where.appliedAt ?? {}), gte: dateFrom };
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      where.appliedAt = { ...(where.appliedAt ?? {}), lte: end };
    }
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
    // Queue/list screens only need the candidate and vacancy basics. The heavy
    // relations (skills, education, history, CV files, status history) are
    // fetched on demand from GET /applications/:id. Pass full=1 when a list
    // really needs them (for example the department people panel).
    const full = ["1", "true", "yes"].includes(String(req.query.full ?? "").toLowerCase());
    // The cache key must contain every input that shapes `where`, including the
    // caller's candidate filter and department scope. Omitting them allowed a
    // cached result from one scope/user to be served to another (data leak).
    const filterKey = [
      statuses.join(",") || "-", req.query.jobOpeningId ?? "-", req.query.candidateId ?? "-", search ?? "-",
      req.query.departmentId ?? "-", req.query.dateFrom ?? "-", req.query.dateTo ?? "-",
      scope === null ? "-" : scope.join(","), full ? "full" : "compact",
    ].join("|");
    const include: any = full
      ? { candidate: { include: { skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true, cvFile: true } }, jobOpening: { include: { department: true } }, resumeFile: true, statusHistory: { include: { changedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 10 } }
      : {
          candidate: { select: {
            id: true, candidateCode: true, fullName: true, email: true, mobile: true, currentLocation: true,
            qualification: true, graduationYear: true, totalExperience: true, relevantExperience: true,
            currentOrganization: true, currentDesignation: true, specialization: true, linkedin: true,
          } },
          jobOpening: { select: { id: true, title: true, departmentId: true, department: true } },
        };
    const [items, total] = await Promise.all([
      cached(CACHE_KEYS.applicationsList(page, pageSize, filterKey), env.cacheTtlSeconds, async () =>
        prisma.application.findMany({ where, skip, take, orderBy: { appliedAt: "desc" }, include }),
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
    // Screening screens only need the candidate profile, vacancy and AI match;
    // skip the interview/offer/document/history joins for a much lighter read.
    const compact = ["1", "true", "yes"].includes(String(req.query.compact ?? "").toLowerCase());
    const profile = ["1", "true", "yes"].includes(String(req.query.profile ?? "").toLowerCase());
    const include: any = profile
      ? {
          // Candidate Profile only needs identity, skills, vacancy basics, CV
          // metadata and the status timeline — not interviews, offers, remarks,
          // documents or full education/history records.
          candidate: {
            select: {
              id: true, candidateCode: true, fullName: true, email: true, mobile: true,
              currentDesignation: true, currentLocation: true, status: true,
              skills: { include: { skill: { select: { id: true, name: true } } } },
            },
          },
          jobOpening: { select: { id: true, title: true, minExperience: true, requiredQualification: true, department: { select: { id: true, name: true } } } },
          resumeFile: { select: { id: true, originalName: true, mimeType: true } },
          statusHistory: { include: { changedBy: { select: { id: true, email: true } } }, orderBy: { createdAt: "desc" } },
          matches: { orderBy: { computedAt: "desc" }, take: 1 },
        }
      : compact
      ? {
          candidate: { include: { skills: { include: { skill: true } }, education: { orderBy: { endYear: "desc" } } } },
          jobOpening: { include: { department: true } },
          matches: true,
        }
      : {
          candidate: { include: { skills: { include: { skill: true } }, cvFile: true, education: { orderBy: { endYear: "desc" } }, employmentHistory: { orderBy: { startDate: "desc" } }, certifications: true } },
          jobOpening: { include: { department: true } },
          resumeFile: true,
          statusHistory: { include: { changedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
          remarks: { include: { author: true }, orderBy: { createdAt: "desc" } },
          interviews: { include: { feedback: true }, orderBy: { scheduledAt: "desc" } },
          offer: true,
          documents: { include: { category: true, file: true } },
          matches: true,
        };
    const item = await prisma.application.findUnique({ where: { id }, include });
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
    // Allow re-saving the hiring decision on the same stage so HR can correct
    // salary/expected salary/notes after submitting without a state transition.
    const sameStatus = status === app.status;
    const allowed = APPLICATION_TRANSITIONS[app.status] ?? [];
    if (!sameStatus && !allowed.includes(status)) throw ApiError.badRequest(`Cannot move application from ${app.status} to ${status}.`);

    const prev = app.status;
    const selectionFields: Record<string, unknown> = {};
    if (parsed.data.finalSelectionSalary !== undefined) selectionFields.finalSelectionSalary = parsed.data.finalSelectionSalary;
    if (parsed.data.finalSelectionExpectedSalary !== undefined) selectionFields.finalSelectionExpectedSalary = parsed.data.finalSelectionExpectedSalary;
    if (parsed.data.finalSelectionNote !== undefined) selectionFields.finalSelectionNote = parsed.data.finalSelectionNote;
    const [updated] = await Promise.all([
      prisma.application.update({ where: { id }, data: { status, ...selectionFields, ...(remarks !== undefined ? { hrRemarks: remarks } : {}) }, include: { candidate: true, jobOpening: true } }),
      sameStatus ? Promise.resolve(null) : prisma.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: prev, toStatus: status, changedById: req.auth!.subjectId, remarks } }),
    ]);
    await cache.applicationsChanged();

    const candidateEmail = app.candidate.email;
    const candidateName = app.candidate.fullName;
    const jobTitle = app.jobOpening.title;

    const notifications: Promise<unknown>[] = [
      logAudit(req, { action: "APPLICATION_STATUS_CHANGE", entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { from: prev, to: status, remarks } }),
    ];

    if (!sameStatus) {
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
    }
    await Promise.allSettled(notifications);
    return ok(res, { item: updated, label: APPLICATION_STATUS_LABELS[status] });
  }),
);

const approvalDetailsSchema = z.object({
  finalSelectionSalary: optionalSalary.optional(),
  finalSelectionExpectedSalary: optionalSalary.optional(),
  finalSelectionNote: z.union([z.string().max(1000), z.null()]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one approval detail to update.");

router.patch(
  "/:id/approval",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = approvalDetailsSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid approval details.", parsed.error.flatten());
    const app = await prisma.application.findUnique({ where: { id }, include: { candidate: true } });
    if (!app) throw ApiError.notFound("Application not found.");
    const updated = await prisma.application.update({
      where: { id },
      data: { ...parsed.data } as any,
      include: { candidate: true, jobOpening: true },
    });
    await logAudit(req, { action: "APPROVAL_DETAIL_UPDATE", entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { changedFields: Object.keys(parsed.data), candidateId: app.candidateId } });
    return ok(res, { item: updated });
  }),
);

// Admin approves the HR hiring recommendation (designation + salary) or rejects it to the hold pipeline.
const adminDecisionSchema = z.object({
  action: z.enum(["confirm", "reject"]),
  remarks: z.string().max(1000).optional().nullable(),
});

router.post(
  "/:id/admin-decision",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes("SUPER_ADMIN") && !roles.includes("IT_ADMIN")) {
      throw ApiError.forbidden("Only an administrator can approve or reject a hiring recommendation.");
    }
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = adminDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid admin decision.", parsed.error.flatten());
    const app = await prisma.application.findUnique({ where: { id }, include: { candidate: true, jobOpening: true } });
    if (!app) throw ApiError.notFound("Application not found.");
    if (app.status !== APPLICATION_STATUS.SELECTED) throw ApiError.badRequest("Only candidates submitted for admin approval can be decided here.");
    if (parsed.data.action === "confirm" && app.adminApprovedAt) {
      throw ApiError.conflict("This candidate has already been approved. Refresh the approval list to continue.");
    }

    if (parsed.data.action === "confirm") {
      const updated = await prisma.application.update({
        where: { id },
        data: { adminApprovedAt: new Date() },
        include: { candidate: true, jobOpening: true },
      });
      await prisma.applicationStatusHistory.create({
        data: { applicationId: id, fromStatus: app.status, toStatus: app.status, changedById: req.auth!.subjectId, remarks: parsed.data.remarks?.trim() || "Admin approved the offer — returned to HR for offer letter creation." },
      });
      await logAudit(req, { action: "ADMIN_APPROVAL_CONFIRM", entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { candidateId: app.candidateId } });
      await cache.applicationsChanged();
      return ok(res, { item: updated, label: "Admin approved" });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: APPLICATION_STATUS.ON_HOLD, adminApprovedAt: null, hrRemarks: parsed.data.remarks?.trim() || "Rejected during admin approval — moved to hold pipeline." },
      include: { candidate: true, jobOpening: true },
    });
    await prisma.applicationStatusHistory.create({
      data: { applicationId: id, fromStatus: app.status, toStatus: APPLICATION_STATUS.ON_HOLD, changedById: req.auth!.subjectId, remarks: parsed.data.remarks?.trim() || "Rejected during admin approval — moved to hold pipeline." },
    });
    await cache.applicationsChanged();
    await logAudit(req, { action: "ADMIN_APPROVAL_REJECT", entityType: "Application", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { candidateId: app.candidateId } });
    return ok(res, { item: updated, label: "Rejected — moved to hold pipeline" });
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
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: id }, include: { changedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } });
    return ok(res, { history });
  }),
);

const assignToJobSchema = z.object({
  jobOpeningId: z.string().min(1),
  shortlist: z.boolean().optional().default(true),
});

router.post(
  "/:id/assign-to-job",
  requirePermission("applications.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = assignToJobSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Select a position to assign this candidate to.", parsed.error.flatten());
    const { jobOpeningId, shortlist } = parsed.data;
    const source = await prisma.application.findUnique({ where: { id }, include: { candidate: true } });
    if (!source) throw ApiError.notFound("Application not found.");
    const target = await prisma.jobOpening.findUnique({ where: { id: jobOpeningId } });
    if (!target) throw ApiError.notFound("Position not found.");
    if (target.id === source.jobOpeningId) throw ApiError.badRequest("This candidate is already assigned to that position.");

    const existing = await prisma.application.findFirst({ where: { candidateId: source.candidateId, jobOpeningId: target.id } });
    const allowed = APPLICATION_TRANSITIONS[existing?.status ?? APPLICATION_STATUS.APPLIED] ?? [];
    const targetStatus = shortlist ? APPLICATION_STATUS.SHORTLISTED : APPLICATION_STATUS.APPLIED;

    if (existing) {
      if (shortlist && existing.status !== APPLICATION_STATUS.SHORTLISTED && allowed.includes(APPLICATION_STATUS.SHORTLISTED)) {
        const updated = await prisma.application.update({
          where: { id: existing.id },
          data: { status: APPLICATION_STATUS.SHORTLISTED },
          include: { candidate: true, jobOpening: true },
        });
        await prisma.applicationStatusHistory.create({
          data: { applicationId: existing.id, fromStatus: existing.status, toStatus: APPLICATION_STATUS.SHORTLISTED, changedById: req.auth!.subjectId, remarks: "Shortlisted from the pipelined employees list." },
        });
        await cache.applicationsChanged();
        await logAudit(req, { action: "APPLICATION_ASSIGN_JOB", entityType: "Application", entityId: existing.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { fromApplicationId: id, jobOpeningId: target.id, status: APPLICATION_STATUS.SHORTLISTED } });
        return ok(res, { item: updated, message: `${source.candidate.fullName} is now shortlisted for ${target.title}.` });
      }
      return ok(res, { item: existing, message: `${source.candidate.fullName} already has an application for ${target.title}.`, unchanged: true });
    }

    const prefix = `${target.jobCode}/A`;
    const siblings = await prisma.application.findMany({ where: { applicationCode: { startsWith: prefix } }, select: { applicationCode: true } });
    const maxSeq = siblings.reduce((max, row) => {
      const seq = Number.parseInt(row.applicationCode.slice(prefix.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
    const item = await prisma.application.create({
      data: {
        applicationCode: `${prefix}${maxSeq + 1}`,
        candidateId: source.candidateId,
        jobOpeningId: target.id,
        status: targetStatus,
        source: "HR_PIPELINE",
        resumeFileId: source.resumeFileId ?? undefined,
      },
      include: { candidate: true, jobOpening: true },
    });
    if (targetStatus !== APPLICATION_STATUS.APPLIED) {
      await prisma.applicationStatusHistory.create({
        data: { applicationId: item.id, fromStatus: APPLICATION_STATUS.APPLIED, toStatus: targetStatus, changedById: req.auth!.subjectId, remarks: "Assigned from the pipelined employees list." },
      });
    }
    await cache.applicationsChanged();
    await logAudit(req, { action: "APPLICATION_ASSIGN_JOB", entityType: "Application", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { fromApplicationId: id, jobOpeningId: target.id, status: targetStatus } });
    return created(res, { item, message: shortlist ? `${source.candidate.fullName} was assigned to ${target.title} and shortlisted.` : `${source.candidate.fullName} was assigned to ${target.title}.` });
  }),
);

export default router;
