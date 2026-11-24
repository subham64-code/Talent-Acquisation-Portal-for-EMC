import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok } from "../utils/http";
import { authenticate, requireAuth, requireHr, requirePermission, departmentScope } from "../middleware/auth";
import { cached, CACHE_KEYS } from "../lib/cache";
import { env } from "../config/env";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("dashboard.view"));

/**
 * Department-scoped version of the overview. Every aggregate is derived from
 * CTEs limited to the caller's departments, so a restricted role can never see
 * another department's counts. Full-access roles keep the faster raw query.
 */
async function scopedOverview(departments: string[]) {
  const rows: any = await prisma.$queryRaw`
    WITH scope(id) AS (SELECT unnest(${departments}::text[]) AS id),
    openings AS (
      SELECT o.* FROM emc_talent.job_openings o WHERE o."departmentId" IN (SELECT id FROM scope)
    ),
    apps AS (
      SELECT a.* FROM emc_talent.applications a WHERE a."jobOpeningId" IN (SELECT id FROM openings)
    ),
    interviews AS (
      SELECT i.* FROM emc_talent.interviews i WHERE i."applicationId" IN (SELECT id FROM apps)
    ),
    offers AS (
      SELECT o.* FROM emc_talent.offer_letters o WHERE o."applicationId" IN (SELECT id FROM apps)
    ),
    docs AS (
      SELECT d.* FROM emc_talent.candidate_documents d WHERE d."applicationId" IN (SELECT id FROM apps)
    ),
    employees AS (
      SELECT e.* FROM emc_talent.employees e WHERE e."departmentId" IN (SELECT id FROM scope)
    ),
    invitations AS (
      SELECT v.* FROM emc_talent.employee_update_invitations v WHERE v."employeeId" IN (SELECT id FROM employees)
    )
    SELECT
      (SELECT count(*)::int FROM employees) AS "totalEmployees",
      (SELECT count(*)::int FROM employees WHERE status = 'EXISTING') AS "existingEmployees",
      (SELECT count(*)::int FROM employees WHERE status = 'FORMER') AS "formerEmployees",
      (SELECT count(*)::int FROM scope) AS "totalDepartments",
      (SELECT count(*)::int FROM openings WHERE status = 'PUBLISHED') AS "activeJobOpenings",
      (SELECT count(*)::int FROM openings WHERE status = 'CLOSED') AS "closedJobOpenings",
      (SELECT count(*)::int FROM apps) AS "totalApplications",
      (SELECT count(*)::int FROM apps WHERE status = 'SHORTLISTED') AS "shortlistedCandidates",
      (SELECT count(*)::int FROM interviews WHERE status IN ('SCHEDULED','RESCHEDULED')) AS "interviewsScheduled",
      (SELECT count(*)::int FROM apps WHERE status = 'SELECTED') AS "selectedCandidates",
      (SELECT count(*)::int FROM apps WHERE status = 'REJECTED') AS "rejectedCandidates",
      (SELECT count(*)::int FROM offers WHERE status = 'SENT') AS "pendingOffers",
      (SELECT count(*)::int FROM apps WHERE status = 'HIRED') AS "hiredEmployees",
      (SELECT count(*)::int FROM docs WHERE status <> 'ACCEPTED') AS "pendingDocumentVerification",
      (SELECT count(DISTINCT "candidateId")::int FROM apps) AS "pipelineCandidates",
      (SELECT count(*)::int FROM apps WHERE status = 'ON_HOLD') AS "candidatesOnHold",
      (SELECT count(*)::int FROM invitations WHERE "usedAt" IS NULL) AS "pendingInvitations",
      (SELECT count(*)::int FROM invitations WHERE submission IS NOT NULL AND ("submissionStatus" IS NULL OR "submissionStatus" = 'PENDING')) AS "pendingSubmissions",
      (SELECT count(*)::int FROM apps WHERE status = 'APPLIED') AS "newApplications",
      (SELECT count(*)::int FROM apps WHERE status IN ('UNDER_REVIEW','AI_RECOMMENDED')) AS "underScreening",
      (SELECT count(*)::int FROM interviews WHERE status IN ('SCHEDULED','RESCHEDULED') AND "scheduledAt" >= now()) AS "upcomingInterviews",
      (SELECT count(*)::int FROM apps a WHERE a.status = 'SELECTED' AND NOT EXISTS (SELECT 1 FROM offers o WHERE o."applicationId" = a.id)) AS "pendingApprovals",
      (SELECT count(*)::int FROM offers WHERE status = 'SENT') AS "offersSentOverview",
      (SELECT count(*)::int FROM apps WHERE status = 'OFFER_SENT') AS "offersAwaitingResponse",
      (SELECT count(*)::int FROM apps WHERE status = 'DOCUMENTS_PENDING') AS "acceptedAwaitingDocuments",
      (SELECT count(*)::int FROM docs WHERE status IN ('UPLOADED','UNDER_REVIEW')) AS "documentsAwaitingVerification",
      (SELECT count(*)::int FROM docs WHERE status = 'REUPLOAD_REQUIRED') AS "documentsResubmissionRequired",
      (SELECT count(*)::int FROM apps WHERE status IN ('OFFER_ACCEPTED','DOCUMENTS_PENDING','DOCUMENTS_UNDER_REVIEW')) AS "joiningPending",
      (SELECT count(*)::int FROM apps WHERE status = 'HIRED') AS "employeesHandedOver"
  `;
  return Array.isArray(rows) ? rows[0] : rows;
}

/** Shared mapping so scoped and unscoped overviews return exactly the same shape. */
function mapOverview(raw: any) {
  return {
    totalEmployees: raw.totalEmployees,
    existingEmployees: raw.existingEmployees,
    formerEmployees: raw.formerEmployees,
    totalDepartments: raw.totalDepartments,
    activeJobOpenings: raw.activeJobOpenings,
    closedJobOpenings: raw.closedJobOpenings,
    totalApplications: raw.totalApplications,
    shortlistedCandidates: raw.shortlistedCandidates,
    interviewsScheduled: raw.interviewsScheduled,
    selectedCandidates: raw.selectedCandidates,
    rejectedCandidates: raw.rejectedCandidates,
    pendingOffers: raw.pendingOffers,
    hiredEmployees: raw.hiredEmployees,
    pendingDocumentVerification: raw.pendingDocumentVerification,
    pipelineCandidates: raw.pipelineCandidates,
    candidatesOnHold: raw.candidatesOnHold,
    pendingInvitations: raw.pendingInvitations,
    pendingSubmissions: raw.pendingSubmissions,
    newApplications: raw.newApplications,
    underScreening: raw.underScreening,
    upcomingInterviews: raw.upcomingInterviews,
    pendingApprovals: raw.pendingApprovals,
    offersSentCount: raw.offersSentOverview,
    offersAwaitingResponse: raw.offersAwaitingResponse,
    acceptedAwaitingDocuments: raw.acceptedAwaitingDocuments,
    documentsAwaitingVerification: raw.documentsAwaitingVerification,
    documentsResubmissionRequired: raw.documentsResubmissionRequired,
    joiningPending: raw.joiningPending,
    employeesHandedOver: raw.employeesHandedOver,
  };
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const scope = departmentScope(req.auth);
    if (scope !== null) {
      // Scoped data must never be served from the shared global cache.
      return ok(res, mapOverview(await scopedOverview(scope)));
    }
    const data = await cached(CACHE_KEYS.dashboardOverview(), env.cacheTtlSeconds, async () => {
      // A single raw query keeps the round trips to one over a slow link (Neon).
      const rows: any = await prisma.$queryRaw`
          SELECT
            (SELECT count(*)::int FROM emc_talent.employees) AS "totalEmployees",
            (SELECT count(*)::int FROM emc_talent.employees WHERE status = 'EXISTING') AS "existingEmployees",
            (SELECT count(*)::int FROM emc_talent.employees WHERE status = 'FORMER') AS "formerEmployees",
            (SELECT count(*)::int FROM emc_talent.departments WHERE "isActive" = true) AS "totalDepartments",
            (SELECT count(*)::int FROM emc_talent.job_openings WHERE status = 'PUBLISHED') AS "activeJobOpenings",
            (SELECT count(*)::int FROM emc_talent.job_openings WHERE status = 'CLOSED') AS "closedJobOpenings",
            (SELECT count(*)::int FROM emc_talent.applications) AS "totalApplications",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'SHORTLISTED') AS "shortlistedCandidates",
            (SELECT count(*)::int FROM emc_talent.interviews WHERE status IN ('SCHEDULED','RESCHEDULED')) AS "interviewsScheduled",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'SELECTED') AS "selectedCandidates",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'REJECTED') AS "rejectedCandidates",
            (SELECT count(*)::int FROM emc_talent.offer_letters WHERE status = 'SENT') AS "pendingOffers",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'HIRED') AS "hiredEmployees",
            (SELECT count(*)::int FROM emc_talent.candidate_documents WHERE status <> 'ACCEPTED') AS "pendingDocumentVerification",
            (SELECT count(*)::int FROM emc_talent.candidates) AS "pipelineCandidates",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'ON_HOLD') AS "candidatesOnHold",
            (SELECT count(*)::int FROM emc_talent.employee_update_invitations WHERE "usedAt" IS NULL) AS "pendingInvitations",
            (SELECT count(*)::int FROM emc_talent.employee_update_invitations WHERE submission IS NOT NULL AND ("submissionStatus" IS NULL OR "submissionStatus" = 'PENDING')) AS "pendingSubmissions",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'APPLIED') AS "newApplications",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status IN ('UNDER_REVIEW','AI_RECOMMENDED')) AS "underScreening",
            (SELECT count(*)::int FROM emc_talent.interviews WHERE status IN ('SCHEDULED','RESCHEDULED') AND "scheduledAt" >= now()) AS "upcomingInterviews",
            (SELECT count(*)::int FROM emc_talent.applications a WHERE a.status = 'SELECTED' AND NOT EXISTS (SELECT 1 FROM emc_talent.offer_letters o WHERE o."applicationId" = a.id)) AS "pendingApprovals",
            (SELECT count(*)::int FROM emc_talent.offer_letters WHERE status = 'SENT') AS "offersSentOverview",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'OFFER_SENT') AS "offersAwaitingResponse",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'DOCUMENTS_PENDING') AS "acceptedAwaitingDocuments",
            (SELECT count(*)::int FROM emc_talent.candidate_documents WHERE status IN ('UPLOADED','UNDER_REVIEW')) AS "documentsAwaitingVerification",
            (SELECT count(*)::int FROM emc_talent.candidate_documents WHERE status = 'REUPLOAD_REQUIRED') AS "documentsResubmissionRequired",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status IN ('OFFER_ACCEPTED','DOCUMENTS_PENDING','DOCUMENTS_UNDER_REVIEW')) AS "joiningPending",
            (SELECT count(*)::int FROM emc_talent.applications WHERE status = 'HIRED') AS "employeesHandedOver"
        `;
        const raw = Array.isArray(rows) ? rows[0] : rows;
        return mapOverview(raw);
      });
      return ok(res, data);
  }),
);

router.get(
  "/departments",
  asyncHandler(async (req, res) => {
    const data = await cached(CACHE_KEYS.dashboardDepartments(), env.cacheTtlSeconds, async () => {
      // Single grouped query keeps the round trips to one over a slow Neon link.
      const rows: any = await prisma.$queryRaw`
        SELECT
          d.id,
          d.name,
          d.code,
          (SELECT count(*)::int FROM emc_talent.employees e WHERE e."departmentId" = d.id) AS "totalEmployees",
          (SELECT count(*)::int FROM emc_talent.employees e WHERE e."departmentId" = d.id AND e.status = 'FORMER') AS "formerEmployees",
          (SELECT count(*)::int FROM emc_talent.employees e WHERE e."departmentId" = d.id AND e."employmentTypeId" IS NOT NULL) AS "fullTime",
          (SELECT count(*)::int FROM emc_talent.job_openings o WHERE o."departmentId" = d.id AND o.status = 'PUBLISHED') AS "activeOpenings",
          (SELECT count(*)::int FROM emc_talent.applications a
             JOIN emc_talent.job_openings o ON o.id = a."jobOpeningId"
             WHERE o."departmentId" = d.id) AS "totalApplicants",
          (SELECT count(*)::int FROM emc_talent.applications a
             JOIN emc_talent.job_openings o ON o.id = a."jobOpeningId"
             WHERE o."departmentId" = d.id
               AND a.status IN ('SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','SELECTED','OFFERED','HIRED')) AS "screened",
          (SELECT count(*)::int FROM emc_talent.interviews i
             JOIN emc_talent.applications a ON a.id = i."applicationId"
             JOIN emc_talent.job_openings o ON o.id = a."jobOpeningId"
             WHERE o."departmentId" = d.id) AS "interviews",
          (SELECT count(*)::int FROM emc_talent.applications a
             JOIN emc_talent.job_openings o ON o.id = a."jobOpeningId"
             WHERE o."departmentId" = d.id AND a.status = 'HIRED') AS "hired"
        FROM emc_talent.departments d
        WHERE d."isActive" = true
        ORDER BY d.name ASC
      `;
      return Array.isArray(rows) ? rows : [];
    });
    // Department-scoped roles must never see another department's pipeline.
    const scope = departmentScope(req.auth);
    const departments = scope === null ? data : data.filter((item: any) => scope.includes(item.id));
    return ok(res, { departments });
  }),
);

router.get(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const scope = departmentScope(req.auth);
    if (scope !== null && !scope.includes(id)) throw ApiError.forbidden("This department is outside your access scope.");
    // Counts and grouped aggregates run in the database in parallel instead of
    // loading whole employee/opening/application tables into memory to count.
    const [dept, totalEmployees, activeOpenings, statusGroups, employees] = await Promise.all([
      prisma.department.findUnique({ where: { id }, select: { id: true, name: true, code: true, description: true, isActive: true } }),
      prisma.employee.count({ where: { departmentId: id } }),
      prisma.jobOpening.count({ where: { departmentId: id, status: "PUBLISHED" } }),
      prisma.application.groupBy({ by: ["status"], where: { jobOpening: { departmentId: id } }, _count: { _all: true } }),
      prisma.employee.findMany({
        where: { departmentId: id },
        select: { id: true, fullName: true, employeeCode: true, officialEmail: true, employmentType: { select: { name: true } } },
        orderBy: { fullName: "asc" }, take: 100,
      }),
    ]);
    if (!dept) throw ApiError.notFound("Department not found.");
    const countFor = (status: string) => statusGroups.find((group) => group.status === status)?._count._all ?? 0;
    return ok(res, {
      department: dept,
      totalEmployees,
      employees,
      activeOpenings,
      totalApplicants: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      shortlisted: countFor("SHORTLISTED"),
      selected: countFor("SELECTED"),
    });
  }),
);

/** Builds chart data; `scope` limits every series to the caller's departments. */
async function buildCharts(scope: string[] | null) {
  const deptWhere = scope === null ? {} : { departmentId: { in: scope } };
  const appWhere = scope === null ? {} : { jobOpening: { departmentId: { in: scope } } };
  const [deptDist, pipelineFunnel, appsOverTimeRaw, vacanciesByDept, experienceDist, employmentTypeDist, aiStats] = await Promise.all([
    prisma.employee.groupBy({ by: ["departmentId"] as const, where: deptWhere, _count: { id: true } }).then((rows) => rows.map((r) => ({ departmentId: r.departmentId, count: r._count.id }))),
    prisma.application.groupBy({ by: ["status"] as const, where: appWhere, _count: { _all: true } }).then((rows) => rows.map((r) => ({ status: r.status, count: r._count._all }))),
    scope === null
      ? prisma.$queryRaw<Array<{ month: string; count: number }>>`
          SELECT to_char(date_trunc('month', "appliedAt"), 'YYYY-MM') AS month, count(*)::int AS count
          FROM emc_talent.applications
          WHERE "appliedAt" >= (date_trunc('month', now()) - interval '11 months')
          GROUP BY 1 ORDER BY 1
        `
      : prisma.$queryRaw<Array<{ month: string; count: number }>>`
          SELECT to_char(date_trunc('month', a."appliedAt"), 'YYYY-MM') AS month, count(*)::int AS count
          FROM emc_talent.applications a
          JOIN emc_talent.job_openings o ON o.id = a."jobOpeningId"
          WHERE a."appliedAt" >= (date_trunc('month', now()) - interval '11 months')
            AND o."departmentId" = ANY(${scope}::text[])
          GROUP BY 1 ORDER BY 1
        `,
    prisma.jobOpening.groupBy({ by: ["departmentId"] as const, where: { status: "PUBLISHED", ...deptWhere }, _count: { id: true } }).then((rows) => rows.map((r) => ({ departmentId: r.departmentId, count: r._count.id }))),
    prisma.employee.groupBy({ by: ["status"] as const, where: deptWhere, _count: { id: true } }).then((rows) => rows.map((r) => ({ status: r.status, count: r._count.id }))),
    prisma.employee.groupBy({ by: ["employmentTypeId"] as const, where: deptWhere, _count: { id: true } }).then((rows) => rows.map((r) => ({ employmentTypeId: r.employmentTypeId, count: r._count.id }))),
    Promise.all([
      scope === null ? prisma.aiScreeningRun.count() : prisma.aiScreeningRun.count({ where: { jobOpening: { departmentId: { in: scope } } } }),
      scope === null ? prisma.candidateJobMatch.count() : prisma.candidateJobMatch.count({ where: { jobOpening: { departmentId: { in: scope } } } }),
    ]).then(([runs, matches]) => ({ runs, matches, avg: 0 })),
  ]);

  return {
    departmentDistribution: deptDist,
    pipelineFunnel,
    applicationsOverTime: appsOverTimeRaw,
    vacanciesByDepartment: vacanciesByDept,
    experienceDistribution: experienceDist,
    employmentTypeDistribution: employmentTypeDist,
    aiStatistics: aiStats,
  };
}

router.get(
  "/charts",
  asyncHandler(async (req, res) => {
    const scope = departmentScope(req.auth);
    if (scope !== null) {
      return ok(res, await buildCharts(scope));
    }
    const data = await cached(CACHE_KEYS.dashboardCharts(), env.cacheTtlSeconds, () => buildCharts(null));
    return ok(res, data);
  }),
);

export default router;
