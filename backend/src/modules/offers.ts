import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, created, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimit";
import { logAudit } from "../services/audit.service";
import { cache } from "../services/cache.service";
import { notifyHrTeam, notifyCandidate } from "../services/notification.service";
import { sendEmail, sendTemplateEmail } from "../integrations/email/email.service";
import { readStoredFile, storeFile, STORAGE_BUCKETS } from "../storage/index";
import { env } from "../config/env";
import { OFFER_STATUS, APPLICATION_STATUS, APPLICATION_STATUS_LABELS } from "../config/constants";
import PDFDocument from "pdfkit";
import { signPurposeToken, verifyPurposeToken } from "../utils/jwt";

const router = express.Router();

const respondSchema = z.object({
  token: z.string().min(1),
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  remarks: z.string().optional().nullable(),
});

router.post(
  "/respond",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { token, decision, remarks } = parsed.data;
    const decoded = verifyPurposeToken(token, "OFFER_RESPONSE") as unknown as { offerId: string; candidateId: string };
    const offer = await prisma.offerLetter.findUnique({ where: { id: decoded.offerId }, include: { application: { include: { candidate: true, jobOpening: true } } } });
    if (!offer) throw ApiError.notFound("Offer not found.");
    if (offer.application.candidateId !== decoded.candidateId) throw ApiError.forbidden("This offer response link is not valid for your account.");
    if (offer.status === OFFER_STATUS.EXPIRED || offer.status === OFFER_STATUS.WITHDRAWN) throw ApiError.badRequest("This offer is no longer active.");
    const now = new Date();
    if (offer.expiryDate && offer.expiryDate.getTime() < now.getTime()) {
      await prisma.offerLetter.update({ where: { id: offer.id }, data: { status: OFFER_STATUS.EXPIRED } });
      throw ApiError.badRequest("This offer has expired.");
    }
    const target = decision === "ACCEPTED" ? OFFER_STATUS.ACCEPTED : OFFER_STATUS.DECLINED;
    await prisma.offerLetter.update({ where: { id: offer.id }, data: { status: target, respondedAt: now, responseRemarks: remarks } });
    if (decision === "ACCEPTED") {
      await prisma.application.update({ where: { id: offer.applicationId }, data: { status: APPLICATION_STATUS.OFFER_ACCEPTED } });
      await prisma.applicationStatusHistory.create({ data: { applicationId: offer.applicationId, fromStatus: offer.application.status, toStatus: APPLICATION_STATUS.OFFER_ACCEPTED, changedById: null, remarks: "Candidate accepted offer" } });
      // Initialize required documents
      const categories = await prisma.documentCategory.findMany({ where: { isActive: true } });
      for (const cat of categories) {
        await prisma.candidateDocument.upsert({
          where: { applicationId_categoryId: { applicationId: offer.applicationId, categoryId: cat.id } },
          update: {},
          create: { candidateId: offer.application.candidateId, applicationId: offer.applicationId, categoryId: cat.id, status: "NOT_UPLOADED" },
        });
      }
      const createdDocs = await prisma.documentCategory.count({ where: { isActive: true } });
      await notifyHrTeam({ type: "offer.accepted", title: "Offer accepted", body: `${offer.application.candidate.fullName} accepted the offer for ${offer.designation}.`, entityType: "OfferLetter", entityId: offer.id });

      const uploadToken = signPurposeToken({ applicationId: offer.applicationId, candidateId: offer.application.candidateId }, "DOC_UPLOAD", "7d");
      const uploadLink = `${env.appUrl}/onboard/documents?token=${uploadToken}`;
      void sendTemplateEmail({
        to: offer.application.candidate.email,
        templateKey: "document_upload_request",
        data: {
          name: offer.application.candidate.fullName,
          jobTitle: offer.application.jobOpening.title,
          applicationCode: offer.application.applicationCode,
          documentCount: createdDocs,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          link: uploadLink,
        },
        metadata: { applicationId: offer.applicationId, offerId: offer.id },
      });
      await cache.offersChanged();
    } else {
      await prisma.application.update({ where: { id: offer.applicationId }, data: { status: APPLICATION_STATUS.REJECTED, hrRemarks: remarks } });
      await prisma.applicationStatusHistory.create({ data: { applicationId: offer.applicationId, fromStatus: offer.application.status, toStatus: APPLICATION_STATUS.REJECTED, changedById: null, remarks: "Candidate declined offer" } });
    }
    await logAudit(req, { action: "OFFER_RESPOND", entityType: "OfferLetter", entityId: offer.id, actorId: decoded.candidateId, actorEmail: offer.application.candidate.email, metadata: { decision } });
    const responsePayload: Record<string, unknown> = { message: `Offer ${decision.toLowerCase()}.`, decision };
    if (decision === "ACCEPTED") {
      responsePayload.uploadToken = signPurposeToken({ applicationId: offer.applicationId, candidateId: offer.application.candidateId }, "DOC_UPLOAD", "7d");
      responsePayload.uploadLink = `${env.appUrl}/onboard/documents?token=${responsePayload.uploadToken}`;
    }
    return ok(res, responsePayload);
  }),
);


router.use(authenticate, requireAuth("HR"), requireHr);

const offerSchema = z.object({
  applicationId: z.string().min(1),
  designation: z.string().min(2),
  departmentId: z.string().min(1).optional().nullable(),
  ctc: z.coerce.number().nonnegative().optional().nullable(),
  salaryStructure: z.string().optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employmentTypeId: z.string().min(1).optional().nullable(),
  reportingTo: z.string().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  additionalConditions: z.string().optional().nullable(),
  status: z.nativeEnum(OFFER_STATUS).optional(),
});

function buildOfferPdf(offer: any, application: any, candidate: any, job: any, dept: any, et: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(24).fillColor("#198754").text("EMC", 50, 40, { width: 400, align: "right" });
    doc.fontSize(10).fillColor("#5c5c5c").text("Ecometrics Consultant Pvt. Ltd. (EMC)", 50, 70, { width: 400, align: "right" });
    doc.moveDown();
    doc.fontSize(16).fillColor("#171717").text("OFFER LETTER");
    doc.fontSize(10).fillColor("#6b7280").text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    const lines = [
      `Dear ${candidate.fullName},`,
      `We are pleased to offer you the position of ${offer.designation} at ${job.title} (${dept?.name ?? "EMC"}).`,
      `Employment Type: ${et?.name ?? offer.employmentTypeId ?? "-"}`,
      `Work Location: ${offer.workLocation ?? "-"}`,
      `Date of Joining: ${offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : "-"}`,
      `Annual CTC: ${offer.ctc != null ? offer.ctc : "-"}`,
      `Reporting To: ${offer.reportingTo ?? "-"}`,
      `Offer Valid Till: ${offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString() : "-"}`,
    ];
    for (const line of lines) doc.text(line);
    if (offer.additionalConditions) { doc.moveDown(); doc.text(`Additional Conditions: ${offer.additionalConditions}`); }
    doc.moveDown();
    doc.text("Please review and respond to this offer through the secure link shared with you.");
    doc.moveDown();
    doc.text("We look forward to welcoming you to EMC.");
    doc.moveDown(2);
    doc.text("For Ecometrics Consultant Pvt. Ltd. (EMC)");
    doc.fontSize(10).fillColor("#5c5c5c").text("Human Resources Department");

    doc.end();
  });
}

router.get(
  "/",
  requirePermission("offers.view"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.jobOpeningId) where.application = { jobOpeningId: String(req.query.jobOpeningId) };
    if (search) where.OR = [{ designation: { contains: search, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      prisma.offerLetter.findMany({
        where, skip, take, orderBy: { createdAt: "desc" },
        include: { application: { include: { candidate: true, jobOpening: true } }, department: true, employmentType: true, pdfFile: true },
      }),
      prisma.offerLetter.count({ where }),
    ]);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get(
  "/:id",
  requirePermission("offers.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const item = await prisma.offerLetter.findUnique({
      where: { id },
      include: { application: { include: { candidate: true, jobOpening: { include: { department: true } } } }, department: true, employmentType: true, pdfFile: true },
    });
    if (!item) throw ApiError.notFound("Offer letter not found.");
    return ok(res, { item });
  }),
);

router.post(
  "/",
  requirePermission("offers.manage"),
  asyncHandler(async (req, res) => {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const { applicationId } = parsed.data;
    const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { candidate: true, jobOpening: true } });
    if (!app) throw ApiError.notFound("Application not found.");
    const existing = await prisma.offerLetter.findUnique({ where: { applicationId } });
    if (existing) throw ApiError.conflict("An offer letter already exists for this application.");
    const data: Record<string, unknown> = { ...parsed.data, status: parsed.data.status ?? OFFER_STATUS.DRAFT, createdById: req.auth!.subjectId };
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: String(data.departmentId) } });
      if (!dept) throw ApiError.badRequest("Invalid department.");
    }
    if (data.employmentTypeId) {
      const et = await prisma.employmentType.findUnique({ where: { id: String(data.employmentTypeId) } });
      if (!et) throw ApiError.badRequest("Invalid employment type.");
    }
    const offer = await prisma.offerLetter.create({ data: data as any, include: { department: true, employmentType: true } });
    await cache.offersChanged();
    await logAudit(req, { action: "OFFER_CREATE", entityType: "OfferLetter", entityId: offer.id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email, metadata: { applicationId } });
    return created(res, { item: offer });
  }),
);

router.patch(
  "/:id",
  requirePermission("offers.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid input.", parsed.error.flatten());
    const offer = await prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw ApiError.notFound("Offer letter not found.");
    const updated = await prisma.offerLetter.update({ where: { id }, data: { ...parsed.data } as any, include: { department: true, employmentType: true } });
    await logAudit(req, { action: "OFFER_UPDATE", entityType: "OfferLetter", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated });
  }),
);

router.post(
  "/:id/generate-pdf",
  requirePermission("offers.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const offer = await prisma.offerLetter.findUnique({
      where: { id },
      include: { application: { include: { candidate: true, jobOpening: true } }, department: true, employmentType: true },
    });
    if (!offer) throw ApiError.notFound("Offer letter not found.");
    const pdf = await buildOfferPdf(offer, offer.application, offer.application.candidate, offer.application.jobOpening, offer.department, offer.employmentType);
    const file = await storeFile({ buffer: pdf, originalName: `offer_${offer.application.applicationCode}.pdf`, mimeType: "application/pdf", ownerType: "CANDIDATE", ownerId: offer.application.candidateId, uploadedById: req.auth!.subjectId, bucket: STORAGE_BUCKETS.OFFERS, visibility: "PRIVATE" });
    const updated = await prisma.offerLetter.update({ where: { id }, data: { pdfFileId: file.id } });
    await logAudit(req, { action: "OFFER_PDF_GENERATE", entityType: "OfferLetter", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { item: updated, fileId: file.id });
  }),
);

router.post(
  "/:id/send",
  requirePermission("offers.manage"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const offer = await prisma.offerLetter.findUnique({
      where: { id },
      include: { application: { include: { candidate: true, jobOpening: true } }, department: true, employmentType: true, pdfFile: true },
    });
    if (!offer) throw ApiError.notFound("Offer letter not found.");
    if (!offer.pdfFileId) throw ApiError.badRequest("Generate the offer letter PDF before sending.");
    const pdfBuffer = await readStoredFile(offer.pdfFile!);
    const respondToken = signPurposeToken({ offerId: offer.id, candidateId: offer.application.candidateId }, "OFFER_RESPONSE", "7d");
    const respondLink = `${env.appUrl}/offer/respond?token=${respondToken}`;
    void sendEmail({
      to: offer.application.candidate.email,
      subject: `Your offer from EMC - ${offer.designation}`,
      html: `<p>Dear ${offer.application.candidate.fullName},</p><p>Your offer letter for <b>${offer.designation}</b> is attached.</p><p><a href="${respondLink}">Review and respond to the offer</a>.</p>`,
      text: `Dear ${offer.application.candidate.fullName}, your offer for ${offer.designation} is attached. Respond at ${respondLink}`,
      templateKey: "offer_letter",
      attachments: [{ filename: "offer_letter.pdf", content: pdfBuffer, contentType: "application/pdf" }],
      metadata: { offerId: offer.id, applicationId: offer.applicationId },
    });
    void sendTemplateEmail({
      to: offer.application.candidate.email,
      templateKey: "offer_letter",
      data: { name: offer.application.candidate.fullName, jobTitle: offer.application.jobOpening.title, designation: offer.designation, department: offer.department?.name, ctc: offer.ctc, joiningDate: offer.joiningDate, workLocation: offer.workLocation, expiryDate: offer.expiryDate, link: respondLink },
      metadata: { offerId: offer.id },
    });
    await prisma.offerLetter.update({ where: { id }, data: { status: OFFER_STATUS.SENT, sentAt: new Date() } });
    await notifyHrTeam({ type: "offer.sent", title: "Offer sent", body: `Offer sent to ${offer.application.candidate.fullName} for ${offer.designation}.`, entityType: "OfferLetter", entityId: id, excludeUserId: req.auth!.subjectId });
    await cache.offersChanged();
    await logAudit(req, { action: "OFFER_SEND", entityType: "OfferLetter", entityId: id, actorId: req.auth!.subjectId, actorEmail: req.auth!.email });
    return ok(res, { message: "Offer sent." });
  }),
);


export default router;

