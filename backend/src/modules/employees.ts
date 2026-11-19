import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { randomToken, hashSecret, sha256 } from "../utils/crypto";
import { cvUpload } from "../middleware/upload";
import { storeFile, STORAGE_BUCKETS } from "../storage/index";
import { logAudit } from "../services/audit.service";
import { cache } from "../services/cache.service";
import { notifyHrTeam } from "../services/notification.service";
import { sendTemplateEmail } from "../integrations/email/email.service";
import { env } from "../config/env";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const empSchema = z.object({
  employeeCode: z.string().min(2).max(30),
  fullName: z.string().min(2).max(120),
  officialEmail: z.string().email(),
  personalEmail: z.string().email().optional().nullable(),
  mobile: z.string().optional().nullable(),
  departmentId: z.string().min(1).optional().nullable(),
  designationId: z.string().min(1).optional().nullable(),
  qualification: z.string().optional().nullable(),
  graduationYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  totalExperience: z.coerce.number().nonnegative().optional().nullable(),
  relevantExperience: z.coerce.number().nonnegative().optional().nullable(),
  previousOrganization: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  employmentTypeId: z.string().min(1).optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  status: z.enum(["EXISTING", "FORMER"]).optional(),
  leavingDate: z.coerce.date().optional().nullable(),
  remarks: z.string().optional().nullable(),
  additionalInfo: z.string().optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
  previousDesignation: z.string().max(120).optional().nullable(),
  jobResponsibilities: z.string().max(2000).optional().nullable(),
});

async function syncEducationAndHistory(employeeId: string, data: z.infer<typeof empSchema>) {
  const educationTouched = [data.qualification, data.institution, data.specialization, data.graduationYear].some((v) => v !== undefined && v !== null);
  if (educationTouched) {
    const existing = await prisma.educationRecord.findFirst({ where: { employeeId }, orderBy: { id: "asc" } });
    const degree = data.qualification ?? existing?.degree ?? "—";
    const record = {
      degree,
      institution: data.institution ?? existing?.institution ?? null,
      field: data.specialization ?? existing?.field ?? null,
      endYear: data.graduationYear ?? existing?.endYear ?? null,
    };
    if (existing) await prisma.educationRecord.update({ where: { id: existing.id }, data: record });
    else await prisma.educationRecord.create({ data: { employeeId, ...record } });
  }
  const historyTouched = [data.previousOrganization, data.previousDesignation, data.jobResponsibilities].some((v) => v !== undefined && v !== null);
  if (historyTouched) {
    const existing = await prisma.employmentHistory.findFirst({ where: { employeeId }, orderBy: { id: "asc" } });
    const record = {
      organization: data.previousOrganization ?? existing?.organization ?? "Previous organisation",
      title: data.previousDesignation ?? existing?.title ?? null,
      description: data.jobResponsibilities ?? existing?.description ?? null,
    };
    if (existing) await prisma.employmentHistory.update({ where: { id: existing.id }, data: record });
    else await prisma.employmentHistory.create({ data: { employeeId, ...record } });
  }
}

function empUpdateData(parsed: z.infer<typeof empSchema>) {
  const data: Record<string, unknown> = {};
  const keys: (keyof z.infer<typeof empSchema>)[] = [
    "employeeCode","fullName","officialEmail","personalEmail","mobile","departmentId","designationId",
    "qualification","graduationYear","totalExperience","relevantExperience","previousOrganization",
    "specialization","employmentTypeId","joiningDate","workLocation","status","leavingDate","remarks","additionalInfo",
  ];
  for (const k of keys) {
    const v = parsed[k];
    if (v !== undefined && v !== null && v !== "") data[k] = v;
  }
  return data;
}

router.get(
  "/",
  requirePermission("employees.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req, 20, 1000);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.departmentId) where.departmentId = String(req.query.departmentId);
    if (req.query.designationId) where.designationId = String(req.query.designationId);
    if (req.query.employmentTypeId) where.employmentTypeId = String(req.query.employmentTypeId);
    if (search) where.OR = [{ fullName: { contains: search, mode: "insensitive" } }, { employeeCode: { contains: search, mode: "insensitive" } }, { officialEmail: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      prisma.employee.findMany({ where, skip, take, orderBy: { fullName: "asc" }, include: { department: true, designation: true, employmentType: true } }),
      prisma.employee.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get("/dropdown", requirePermission("employees.view"), asyncHandler(async (_req, res) => {
  const items = await prisma.employee.findMany({ where: { status: "EXISTING" }, select: { id: true, employeeCode: true, fullName: true, officialEmail: true }, orderBy: { fullName: "asc" } });
  return ok(res, { items });
}));

router.get(
  "/:id",
  requirePermission("employees.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.employee.findUnique({
      where: { id },
      include: { department: true, designation: true, employmentType: true, skills: { include: { skill: true } }, education: true, employmentHistory: true, certifications: true, cvVersions: { include: { file: true, uploadedBy: true } }, departmentHistory: { include: { fromDepartment: true, toDepartment: true, changedBy: true } } },
    });
    if (!item) throw ApiError.notFound("Employee not found.");
    return ok(res, { item });
  }),
);

router.post(
  "/",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const parsed = empSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { employeeCode, officialEmail } = parsed.data;
    if (await prisma.employee.findUnique({ where: { employeeCode } })) throw ApiError.conflict("Employee code already exists.");
    if (await prisma.employee.findUnique({ where: { officialEmail } })) throw ApiError.conflict("Official email already exists.");

    const data = empUpdateData(parsed.data);
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: String(data.departmentId) } });
      if (!dept) throw ApiError.badRequest("Invalid department. Please select a valid department.");
    }
    if (data.employmentTypeId) {
      const et = await prisma.employmentType.findUnique({ where: { id: String(data.employmentTypeId) } });
      if (!et) throw ApiError.badRequest("Invalid employment type.");
    }
    if (data.designationId) {
      const des = await prisma.designation.findUnique({ where: { id: String(data.designationId) } });
      if (!des) throw ApiError.badRequest("Invalid designation.");
    }

    const item = await prisma.employee.create({ data: data as any, include: { department: true, designation: true, employmentType: true } });
    await syncEducationAndHistory(item.id, parsed.data);
    await cache.peopleChanged();
    await logAudit(req, { action: "EMPLOYEE_CREATE", entityType: "Employee", entityId: item.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { officialEmail } });
    return created(res, { item });
  }),
);

router.patch(
  "/:id",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = empSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const item = await prisma.employee.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound("Employee not found.");
    if (parsed.data.employeeCode && parsed.data.employeeCode !== item.employeeCode && await prisma.employee.findUnique({ where: { employeeCode: parsed.data.employeeCode } })) throw ApiError.conflict("Employee code already exists.");
    if (parsed.data.officialEmail && parsed.data.officialEmail !== item.officialEmail && await prisma.employee.findUnique({ where: { officialEmail: parsed.data.officialEmail } })) throw ApiError.conflict("Official email already exists.");
    const data = empUpdateData(parsed.data);
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: String(data.departmentId) } });
      if (!dept) throw ApiError.badRequest("Invalid department. Please select a valid department.");
    }
    if (data.employmentTypeId) {
      const et = await prisma.employmentType.findUnique({ where: { id: String(data.employmentTypeId) } });
      if (!et) throw ApiError.badRequest("Invalid employment type.");
    }
    if (data.designationId) {
      const des = await prisma.designation.findUnique({ where: { id: String(data.designationId) } });
      if (!des) throw ApiError.badRequest("Invalid designation.");
    }
    const updated = await prisma.employee.update({ where: { id }, data: data as any, include: { department: true, designation: true, employmentType: true } });
    await syncEducationAndHistory(id, parsed.data);
    await cache.peopleChanged();
    await logAudit(req, { action: "EMPLOYEE_UPDATE", entityType: "Employee", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: parsed.data });
    return ok(res, { item: updated });
  }),
);

router.post(
  "/:id/transfer",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ toDepartmentId: z.string().min(1), reason: z.string().optional().nullable() }).safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("toDepartmentId is required.", body.error.flatten());
    const { toDepartmentId, reason } = body.data;
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw ApiError.notFound("Employee not found.");
    const toDept = await prisma.department.findUnique({ where: { id: toDepartmentId } });
    if (!toDept) throw ApiError.notFound("Target department not found.");
    const history = await prisma.employeeDepartmentHistory.create({
      data: { employeeId: id, fromDepartmentId: employee.departmentId, toDepartmentId, reason, changedById: req.auth!.subjectId },
      include: { fromDepartment: true, toDepartment: true, changedBy: true },
    });
    const updated = await prisma.employee.update({ where: { id }, data: { departmentId: toDepartmentId } });
    await cache.peopleChanged();
    await logAudit(req, { action: "EMPLOYEE_TRANSFER", entityType: "Employee", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { from: employee.departmentId, to: toDepartmentId, reason } });
    await notifyHrTeam({ type: "employee.transfer", title: "Employee department transfer", body: `${employee.fullName} moved to ${toDept.name}.`, entityType: "Employee", entityId: id });
    return ok(res, { item: updated, history });
  }),
);

router.get(
  "/:id/invitations",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const invitations = await prisma.employeeUpdateInvitation.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, include: { createdBy: true } });
    return ok(res, { invitations });
  }),
);

router.post(
  "/:id/invitations",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw ApiError.notFound("Employee not found.");
    const existing = await prisma.employeeUpdateInvitation.findFirst({ where: { employeeId: id, usedAt: null }, orderBy: { createdAt: "desc" } });
    if (existing) throw ApiError.conflict("An active invitation already exists.");
    const token = randomToken();
    const expiresAt: Date | null = null;
    const invitation = await prisma.employeeUpdateInvitation.create({ data: { employeeId: id, tokenHash: sha256(token), createdById: req.auth!.subjectId } });
    const link = `${env.appUrl}/employee/update?token=${token}`;
    void sendTemplateEmail({
      to: employee.officialEmail, templateKey: "employee_update_invitation",
      data: { name: employee.fullName, employeeCode: employee.employeeCode, email: employee.officialEmail, link, expiresAt: null },
      metadata: { invitationId: invitation.id, employeeId: id },
    });
    await logAudit(req, { action: "EMPLOYEE_INVITE_RESEND", entityType: "EmployeeUpdateInvitation", entityId: invitation.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return created(res, { invitationId: invitation.id, message: "Invitation resent." });
  }),
);

router.post(
  "/bulk-invitations",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const parsed = z.object({ emails: z.array(z.string().email()).min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Provide a list of valid email addresses (maximum 500).");
    const unique = Array.from(new Set(parsed.data.emails.map((e) => e.trim().toLowerCase())));
    const results = {
      invited: 0,
      created: 0,
      skipped: [] as Array<{ email: string; reason: string }>,
      failed: [] as Array<{ email: string; reason: string }>,
    };
    for (const email of unique) {
      try {
        let employee = await prisma.employee.findUnique({ where: { officialEmail: email } });
        if (!employee) {
          employee = await prisma.employee.create({
            data: {
              employeeCode: "EMP" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
              fullName: email.split("@")[0],
              officialEmail: email,
              status: "EXISTING",
            },
          });
          results.created += 1;
        }
        const existing = await prisma.employeeUpdateInvitation.findFirst({
          where: { employeeId: employee.id, usedAt: null },
          orderBy: { createdAt: "desc" },
        });
        if (existing) {
          results.skipped.push({ email, reason: "An active invitation already exists." });
          continue;
        }
        const token = randomToken();
        const expiresAt: Date | null = null;
        const invitation = await prisma.employeeUpdateInvitation.create({
          data: { employeeId: employee.id, tokenHash: sha256(token), createdById: req.auth!.subjectId },
        });
        const link = `${env.appUrl}/employee/update?token=${token}`;
        void sendTemplateEmail({
          to: email,
          templateKey: "employee_update_invitation",
          data: { name: employee.fullName, employeeCode: employee.employeeCode, email, link, expiresAt: null },
          metadata: { invitationId: invitation.id, employeeId: employee.id },
        });
        results.invited += 1;
      } catch (err) {
        results.failed.push({ email, reason: (err as Error).message || "Unknown error" });
      }
    }
    await logAudit(req, {
      action: "EMPLOYEE_BULK_INVITE",
      entityType: "EmployeeUpdateInvitation",
      actorId: req.auth!.subjectId,
      actorEmail: req.auth!.email,
      metadata: { invited: results.invited, created: results.created, skipped: results.skipped.length, failed: results.failed.length, total: unique.length },
    });
    return ok(res, results);
  }),
);

router.delete(
  "/:id",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw ApiError.notFound("Employee not found.");
    await prisma.employee.delete({ where: { id } });
    await cache.peopleChanged();
    await logAudit(req, { action: "EMPLOYEE_DELETE", entityType: "Employee", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { officialEmail: employee.officialEmail } });
    return ok(res, { message: "Employee deleted." });
  }),
);

router.delete(
  "/:id/cv",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw ApiError.notFound("Employee not found.");
    await prisma.cvVersion.updateMany({ where: { employeeId: id, isCurrent: true }, data: { isCurrent: false } });
    await prisma.employee.update({ where: { id }, data: { cvFileId: null } });
    await cache.peopleChanged();
    await logAudit(req, { action: "EMPLOYEE_CV_REMOVE", entityType: "Employee", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "CV removed from the employee record." });
  }),
);

router.post(
  "/:id/cv",
  requirePermission("employees.manage"),
  cvUpload.single("cv"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw ApiError.notFound("Employee not found.");
    if (!req.file) throw ApiError.badRequest("CV file is required.");
    const file = await storeFile({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, ownerType: "EMPLOYEE", ownerId: id, uploadedById: req.auth!.subjectId, bucket: STORAGE_BUCKETS.EMPLOYEES, visibility: "PRIVATE" });
    await prisma.cvVersion.create({ data: { employeeId: id, fileId: file.id, version: 1, isCurrent: true, source: "UPLOAD", uploadedById: req.auth!.subjectId } });
    await prisma.employee.update({ where: { id }, data: { cvFileId: file.id } });
    await cache.peopleChanged();
    return ok(res, { fileId: file.id, message: "CV uploaded." });
  }),
);

router.post(
  "/from-application/:applicationId",
  requirePermission("employees.manage"),
  asyncHandler(async (req, res) => {
    const { applicationId } = z.object({ applicationId: z.string().min(1) }).parse(req.params);
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: { include: { skills: true, education: true } },
        jobOpening: true,
        offer: true,
      },
    });
    if (!application) throw ApiError.notFound("Application not found.");
    const eligible = ["SELECTED", "OFFER_SENT", "OFFER_ACCEPTED", "DOCUMENTS_PENDING", "DOCUMENTS_UNDER_REVIEW", "HIRED"];
    if (!eligible.includes(application.status)) {
      throw ApiError.badRequest("Only selected candidates (or those in onboarding) can be moved to existing employees.");
    }
    const candidate = application.candidate;
    const duplicate = await prisma.employee.findUnique({ where: { officialEmail: candidate.email } });
    if (duplicate) throw ApiError.conflict(`An employee with email ${candidate.email} already exists.`);

    // Reuse the offer's department / designation / employment type / joining date when present.
    const departmentId = application.offer?.departmentId ?? application.jobOpening?.departmentId ?? undefined;
    let designationId: string | undefined;
    const wantedDesignation = application.offer?.designation?.trim();
    if (wantedDesignation) {
      const found = await prisma.designation.findFirst({
        where: { name: { equals: wantedDesignation, mode: "insensitive" }, ...(departmentId ? { departmentId } : {}) },
      });
      if (found) {
        designationId = found.id;
      } else {
        try {
          const created_ = await prisma.designation.create({ data: { name: wantedDesignation, departmentId: departmentId ?? undefined } });
          designationId = created_.id;
        } catch { /* designation stays unassigned */ }
      }
    }

    const employeeCode = "EMP" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        fullName: candidate.fullName,
        officialEmail: candidate.email,
        personalEmail: candidate.email,
        mobile: candidate.mobile,
        departmentId,
        designationId,
        employmentTypeId: application.offer?.employmentTypeId ?? undefined,
        joiningDate: application.offer?.joiningDate ?? undefined,
        qualification: candidate.qualification,
        totalExperience: candidate.totalExperience,
        relevantExperience: candidate.relevantExperience,
        previousOrganization: candidate.currentOrganization,
        specialization: candidate.specialization,
        workLocation: application.offer?.workLocation ?? undefined,
        status: "EXISTING",
        cvFileId: candidate.cvFileId ?? undefined,
        additionalInfo: candidate.additionalInfo,
      },
      include: { department: true, designation: true, employmentType: true },
    });

    for (const ed of candidate.education) {
      await prisma.educationRecord.create({
        data: {
          employeeId: employee.id,
          degree: ed.degree,
          institution: ed.institution,
          field: ed.field,
          startYear: ed.startYear,
          endYear: ed.endYear,
          grade: ed.grade,
        },
      }).catch(() => undefined);
    }
    for (const cs of candidate.skills) {
      await prisma.employeeSkill.create({ data: { employeeId: employee.id, skillId: cs.skillId } }).catch(() => undefined);
    }
    if (candidate.cvFileId) {
      await prisma.cvVersion.create({
        data: { employeeId: employee.id, fileId: candidate.cvFileId, version: 1, isCurrent: true, source: "OFFER_CONVERSION", uploadedById: req.auth!.subjectId },
      }).catch(() => undefined);
    }

    await prisma.application.update({ where: { id: application.id }, data: { status: "HIRED" } });
    await prisma.applicationStatusHistory.create({
      data: { applicationId: application.id, fromStatus: application.status, toStatus: "HIRED", changedById: req.auth!.subjectId, remarks: "Onboarding completed — added to Existing Employees" },
    });
    await cache.peopleChanged();
    await cache.offersChanged();
    await logAudit(req, { action: "EMPLOYEE_FROM_APPLICATION", entityType: "Employee", entityId: employee.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { applicationId: application.id, candidateId: candidate.id } });
    return created(res, { item: employee, message: "Candidate added to Existing Employees." });
  }),
);

export default router;
