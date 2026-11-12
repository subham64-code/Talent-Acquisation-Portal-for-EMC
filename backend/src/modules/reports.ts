import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok } from "../utils/http";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { asDate, asString, asArray } from "../utils/pagination";
import { env } from "../config/env";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("reports.view"));

const REPORT_TYPES = [
  "employees", "former-employees", "department-employees", "employment-type",
  "applications", "pipeline", "shortlisting", "interviews", "selections", "rejections",
  "on-hold", "offers", "pending-documents", "ai-rankings", "skill-gap", "vacancies",
];

router.get("/types", asyncHandler(async (_req, res) => {
  return ok(res, { types: REPORT_TYPES });
}));

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
}

async function buildExcel(rows: Record<string, unknown>[], title: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    for (const r of rows) sheet.addRow(headers.map((h) => r[h]));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function buildPdf(rows: Record<string, unknown>[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).fillColor("#198754").text("EMC - " + title, { align: "center" });
    doc.fontSize(10).fillColor("#5c5c5c").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();
    if (rows.length) {
      const headers = Object.keys(rows[0]);
      let x = 40;
      let y = doc.y;
      doc.fontSize(8).fillColor("#171717");
      for (const h of headers) { doc.text(h, x, y, { width: 90 }); x += 95; }
      doc.moveDown();
      for (const r of rows) {
        x = 40;
        for (const h of headers) { doc.text(String(r[h] ?? ""), x, doc.y, { width: 90 }); x += 95; }
        doc.moveDown();
      }
    } else {
      doc.text("No records found.");
    }
    doc.end();
  });
}

router.get(
  "/:type",
  asyncHandler(async (req, res) => {
    const type = z.string().parse(req.params.type);
    if (!REPORT_TYPES.includes(type)) throw ApiError.badRequest("Invalid report type.");
    const format = (req.query.format as string | undefined) || "json";
    const jobOpeningId = asString(req.query.jobOpeningId);
    const departmentId = asString(req.query.departmentId);
    const status = asString(req.query.status);
    const from = asDate(req.query.from);
    const to = asDate(req.query.to);

    let rows: Record<string, unknown>[] = [];
    let title = type;

    switch (type) {
      case "employees": {
        title = "Employee Report";
        const items = await prisma.employee.findMany({
          where: { departmentId, status },
          include: { department: true, designation: true, employmentType: true },
          orderBy: { fullName: "asc" },
        });
        rows = items.map((e) => ({ employeeCode: e.employeeCode, name: e.fullName, email: e.officialEmail, department: e.department?.name, designation: e.designation?.name, qualification: e.qualification, totalExperience: e.totalExperience, status: e.status, joiningDate: e.joiningDate }));
        break;
      }
      case "former-employees": {
        title = "Former Employee Report";
        const items = await prisma.employee.findMany({ where: { status: "FORMER", departmentId }, include: { department: true }, orderBy: { fullName: "asc" } });
        rows = items.map((e) => ({ employeeCode: e.employeeCode, name: e.fullName, email: e.officialEmail, department: e.department?.name, joiningDate: e.joiningDate, leavingDate: e.leavingDate }));
        break;
      }
      case "department-employees": {
        title = "Department-wise Employee Report";
        const groups = await prisma.employee.groupBy({ by: ["departmentId"], _count: { id: true } });
        const depts = await prisma.department.findMany();
        rows = groups.map((g) => ({ department: depts.find((d) => d.id === g.departmentId)?.name, employeeCount: g._count.id }));
        break;
      }
      case "employment-type": {
        title = "Employment Type Report";
        const groups = await prisma.employee.groupBy({ by: ["employmentTypeId"], _count: { id: true } });
        const types = await prisma.employmentType.findMany();
        rows = groups.map((g) => ({ employmentType: types.find((t) => t.id === g.employmentTypeId)?.name, employeeCount: g._count.id }));
        break;
      }
      case "applications": {
        title = "Application Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        if (status) where.status = status;
        if (from || to) where.appliedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
        const items = await prisma.application.findMany({ where, include: { candidate: true, jobOpening: true }, orderBy: { appliedAt: "desc" } });
        rows = items.map((a) => ({ applicationCode: a.applicationCode, candidate: a.candidate.fullName, position: a.jobOpening.title, status: a.status, appliedAt: a.appliedAt }));
        break;
      }
      case "pipeline": {
        title = "Pipeline Report";
        const items = await prisma.candidate.findMany({ where: { status }, orderBy: { fullName: "asc" } });
        rows = items.map((c) => ({ candidateCode: c.candidateCode, name: c.fullName, email: c.email, qualification: c.qualification, totalExperience: c.totalExperience, status: c.status }));
        break;
      }
      case "shortlisting": {
        title = "Shortlisting Report";
        const items = await prisma.application.findMany({ where: { status: "SHORTLISTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ applicationCode: a.applicationCode, candidate: a.candidate.fullName, position: a.jobOpening.title }));
        break;
      }
      case "interviews": {
        title = "Interview Report";
        const items = await prisma.interview.findMany({ include: { application: { include: { candidate: true } } }, orderBy: { scheduledAt: "desc" } });
        rows = items.map((i) => ({ application: i.application.applicationCode, candidate: i.application.candidate.fullName, round: i.round, scheduledAt: i.scheduledAt, status: i.status, result: i.result }));
        break;
      }
      case "selections": {
        title = "Selection Report";
        const items = await prisma.application.findMany({ where: { status: "SELECTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title }));
        break;
      }
      case "rejections": {
        title = "Rejection Report";
        const items = await prisma.application.findMany({ where: { status: "REJECTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title, appliedAt: a.appliedAt }));
        break;
      }
      case "on-hold": {
        title = "On Hold Report";
        const items = await prisma.application.findMany({ where: { status: "ON_HOLD" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title, appliedAt: a.appliedAt }));
        break;
      }
      case "offers": {
        title = "Offer Letter Report";
        const items = await prisma.offerLetter.findMany({ include: { application: { include: { candidate: true } } }, orderBy: { createdAt: "desc" } });
        rows = items.map((o) => ({ candidate: o.application.candidate.fullName, designation: o.designation, ctc: o.ctc, status: o.status, sentAt: o.sentAt }));
        break;
      }
      case "pending-documents": {
        title = "Pending Document Report";
        const items = await prisma.candidateDocument.findMany({ where: { status: { not: "ACCEPTED" } }, include: { category: true, application: { include: { candidate: true } } } });
        rows = items.map((d) => ({ candidate: d.application.candidate.fullName, category: d.category.name, status: d.status, application: d.application.applicationCode }));
        break;
      }
      case "ai-rankings": {
        title = "AI Ranking Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        const items = await prisma.candidateJobMatch.findMany({ where, include: { candidate: true, jobOpening: true }, orderBy: { overallScore: "desc" } });
        rows = items.map((m) => ({ candidate: m.candidate.fullName, position: m.jobOpening.title, overallScore: m.overallScore, skillScore: m.skillScore, experienceScore: m.experienceScore, qualificationScore: m.qualificationScore }));
        break;
      }
      case "skill-gap": {
        title = "Skill Gap Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        const items = await prisma.candidateJobMatch.findMany({ where, include: { candidate: true, jobOpening: true } });
        const gapCounts: Record<string, number> = {};
        for (const m of items) {
          for (const g of (m.gaps as string[]).filter(Boolean)) gapCounts[g] = (gapCounts[g] || 0) + 1;
        }
        rows = Object.entries(gapCounts).map(([skill, count]) => ({ skill, candidateCount: count }));
        break;
      }
      case "vacancies": {
        title = "Vacancy Report";
        const items = await prisma.jobOpening.findMany({ where: { departmentId }, include: { department: true }, orderBy: { createdAt: "desc" } });
        rows = items.map((o) => ({ jobCode: o.jobCode, title: o.title, department: o.department?.name, positions: o.positions, status: o.status, deadline: o.deadline }));
        break;
      }
    }

    const fileName = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") return ok(res, { type, title, count: rows.length, rows });
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}.csv"`);
      return res.send(buildCsv(rows));
    }
    if (format === "excel") {
      const buffer = await buildExcel(rows, title);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}.xlsx"`);
      return res.send(buffer);
    }
    if (format === "pdf") {
      const buffer = await buildPdf(rows, title);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
      return res.send(buffer);
    }
    throw ApiError.badRequest("Unsupported format. Use json, csv, excel, or pdf.");
  }),
);

export default router;
