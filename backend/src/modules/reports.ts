/**
 * Report builder.
 *
 * JSON results are server-paginated (page/pageSize). CSV, Excel and PDF exports
 * are intentionally capped at 10,000 rows so a large table cannot exhaust
 * memory. Add a new report by extending REPORT_TYPES and its switch statement.
 */
import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok } from "../utils/http";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { asDate, asString, getPagination } from "../utils/pagination";
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

async function buildExcel(rows: Record<string, unknown>[], _title: string): Promise<Buffer> {
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

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  const text = String(value).trim();
  if (!text) return "-";
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return text;
}

function prettyHeader(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function buildPdf(
  rows: Record<string, unknown>[],
  title: string,
  meta: { filters?: string[]; total?: number } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom - 28;
    const generatedAt = new Date().toLocaleString();
    const filters = (meta.filters ?? []).filter(Boolean);
    const total = meta.total ?? rows.length;

    const drawPageHeader = () => {
      const x = doc.page.margins.left;
      const top = doc.page.margins.top;
      doc.save();
      doc.roundedRect(x, top, pageWidth, 56, 6).fill("#166534");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text("EMC Talent Acquisition Portal", x + 14, top + 10, {
        width: pageWidth - 28,
        lineBreak: false,
        ellipsis: true,
      });
      doc.font("Helvetica").fontSize(11).fillColor("#dcfce7").text(title, x + 14, top + 33, {
        width: pageWidth - 28,
        lineBreak: false,
        ellipsis: true,
      });
      doc.restore();

      const metaY = top + 66;
      doc.fillColor("#374151").font("Helvetica").fontSize(9);
      const metaParts = [`Generated: ${generatedAt}`, `Records: ${total}`];
      if (filters.length) metaParts.push(`Filters: ${filters.join(" | ")}`);
      doc.text(metaParts.join("    "), x, metaY, { width: pageWidth });
      const lineY = doc.y + 6;
      doc.save().moveTo(x, lineY).lineTo(x + pageWidth, lineY).strokeColor("#d1d5db").lineWidth(1).stroke().restore();
      doc.y = lineY + 10;
    };

    const drawNoData = () => {
      doc.moveDown(2);
      doc.fillColor("#6b7280").font("Helvetica").fontSize(11).text("No records found for the selected filters.", {
        width: pageWidth,
        align: "center",
      });
    };

    drawPageHeader();

    if (!rows.length) {
      drawNoData();
    } else {
      const headers = Object.keys(rows[0]);
      const sampleRows = rows.slice(0, 40);
      const weights = headers.map((h) => {
        const headerLen = prettyHeader(h).length;
        const contentLen = sampleRows.reduce((max, r) => Math.max(max, formatReportValue(r[h]).length), 0);
        return Math.min(34, Math.max(10, Math.max(headerLen, Math.min(contentLen, 28))));
      });
      const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
      const colWidths = weights.map((w) => (w / weightSum) * pageWidth);
      const widthFix = pageWidth - colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += widthFix;

      const drawTableHeader = () => {
        const x = doc.page.margins.left;
        const y = doc.y;
        const headerHeight = 24;
        doc.save();
        doc.rect(x, y, pageWidth, headerHeight).fill("#f3f4f6");
        doc.rect(x, y, pageWidth, headerHeight).strokeColor("#cbd5e1").lineWidth(0.6).stroke();
        let cx = x;
        headers.forEach((h, i) => {
          const w = colWidths[i];
          doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8).text(prettyHeader(h), cx + 4, y + 7, {
            width: w - 8,
            height: 12,
            ellipsis: true,
            lineBreak: false,
          });
          cx += w;
          if (i < headers.length - 1) {
            doc.moveTo(cx, y).lineTo(cx, y + headerHeight).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
          }
        });
        doc.restore();
        doc.y = y + headerHeight;
      };

      drawTableHeader();

      rows.forEach((row, rowIndex) => {
        const values = headers.map((h) => formatReportValue(row[h]));
        doc.font("Helvetica").fontSize(8);
        const heights = values.map((v, i) => doc.heightOfString(v || "-", { width: Math.max(20, colWidths[i] - 8), align: "left" }));
        const rowHeight = Math.min(72, Math.max(20, ...heights.map((h) => Math.ceil(h) + 8)));

        if (doc.y + rowHeight > pageBottom) {
          doc.addPage();
          drawPageHeader();
          drawTableHeader();
        }

        const x = doc.page.margins.left;
        const y = doc.y;
        doc.save();
        if (rowIndex % 2 === 1) doc.rect(x, y, pageWidth, rowHeight).fill("#fafafa");
        doc.rect(x, y, pageWidth, rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        let cx = x;
        values.forEach((v, i) => {
          const w = colWidths[i];
          doc.fillColor("#1f2937").font("Helvetica").fontSize(8).text(v || "-", cx + 4, y + 4, {
            width: Math.max(20, w - 8),
            height: rowHeight - 8,
            ellipsis: true,
          });
          cx += w;
          if (i < headers.length - 1) {
            doc.moveTo(cx, y).lineTo(cx, y + rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
          }
        });
        doc.restore();
        doc.y = y + rowHeight;
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const left = doc.page.margins.left;
      const bottomY = doc.page.height - doc.page.margins.bottom - 12;
      doc.save();
      doc.moveTo(left, bottomY - 6).lineTo(left + pageWidth, bottomY - 6).strokeColor("#d1d5db").lineWidth(0.5).stroke();
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("Confidential - EMC HR Report", left, bottomY, {
        width: pageWidth / 2,
        align: "left",
        lineBreak: false,
      });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, left + pageWidth / 2, bottomY, {
        width: pageWidth / 2,
        align: "right",
        lineBreak: false,
      });
      doc.restore();
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

    // JSON requests are server-paginated. File exports are capped so a report
    // can never load an unbounded table into memory.
    const { page, pageSize, skip, take } = getPagination(req, 20, 100);
    const MAX_EXPORT_ROWS = 10000;
    const pageArgs = format === "json" ? { skip, take } : { take: MAX_EXPORT_ROWS };
    let totalRows = 0;

    /**
     * Fetches one page of a report and remembers the unpaged count for the
     * pagination metadata. `model` is the Prisma delegate name (e.g. "employee").
     */
    const findPaged = async (model: string, args: any): Promise<any[]> => {
      const delegate = (prisma as any)[model];
      const [items, total] = await Promise.all([
        delegate.findMany({ ...args, ...pageArgs }),
        delegate.count({ where: args.where ?? {} }),
      ]);
      if (format === "json") totalRows = total;
      return items;
    };
    /** Paginates rows produced by a groupBy/aggregate report. */
    const pageRows = (all: Record<string, unknown>[]): Record<string, unknown>[] =>
      format === "json" ? all.slice(skip, skip + take) : all.slice(0, MAX_EXPORT_ROWS);

    let rows: Record<string, unknown>[] = [];
    let title = type;

    switch (type) {
      case "employees": {
        title = "Employee Report";
        const items = await findPaged("employee", {
          where: { departmentId, status },
          include: { department: true, designation: true, employmentType: true },
          orderBy: { fullName: "asc" },
        });
        rows = items.map((e) => ({ employeeCode: e.employeeCode, name: e.fullName, email: e.officialEmail, department: e.department?.name, designation: e.designation?.name, qualification: e.qualification, totalExperience: e.totalExperience, status: e.status, joiningDate: e.joiningDate }));
        break;
      }
      case "former-employees": {
        title = "Former Employee Report";
        const items = await findPaged("employee", { where: { status: "FORMER", departmentId }, include: { department: true }, orderBy: { fullName: "asc" } });
        rows = items.map((e) => ({ employeeCode: e.employeeCode, name: e.fullName, email: e.officialEmail, department: e.department?.name, joiningDate: e.joiningDate, leavingDate: e.leavingDate }));
        break;
      }
      case "department-employees": {
        title = "Department-wise Employee Report";
        const groups = await prisma.employee.groupBy({ by: ["departmentId"], _count: { id: true } });
        const depts = await prisma.department.findMany();
        rows = pageRows(groups.map((g) => ({ department: depts.find((d) => d.id === g.departmentId)?.name, employeeCount: g._count.id })));
        totalRows = groups.length;
        break;
      }
      case "employment-type": {
        title = "Employment Type Report";
        const groups = await prisma.employee.groupBy({ by: ["employmentTypeId"], _count: { id: true } });
        const types = await prisma.employmentType.findMany();
        rows = pageRows(groups.map((g) => ({ employmentType: types.find((t) => t.id === g.employmentTypeId)?.name, employeeCount: g._count.id })));
        totalRows = groups.length;
        break;
      }
      case "applications": {
        title = "Application Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        if (status) where.status = status;
        if (from || to) where.appliedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
        const items = await findPaged("application", { where, include: { candidate: true, jobOpening: true }, orderBy: { appliedAt: "desc" } });
        rows = items.map((a) => ({ applicationCode: a.applicationCode, candidate: a.candidate.fullName, position: a.jobOpening.title, status: a.status, appliedAt: a.appliedAt }));
        break;
      }
      case "pipeline": {
        title = "Pipeline Report";
        const items = await findPaged("candidate", { where: { status }, orderBy: { fullName: "asc" } });
        rows = items.map((c) => ({ candidateCode: c.candidateCode, name: c.fullName, email: c.email, qualification: c.qualification, totalExperience: c.totalExperience, status: c.status }));
        break;
      }
      case "shortlisting": {
        title = "Shortlisting Report";
        const items = await findPaged("application", { where: { status: "SHORTLISTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ applicationCode: a.applicationCode, candidate: a.candidate.fullName, position: a.jobOpening.title }));
        break;
      }
      case "interviews": {
        title = "Interview Report";
        const items = await findPaged("interview", { include: { application: { include: { candidate: true } } }, orderBy: { scheduledAt: "desc" } });
        rows = items.map((i) => ({ application: i.application.applicationCode, candidate: i.application.candidate.fullName, round: i.round, scheduledAt: i.scheduledAt, status: i.status, result: i.result }));
        break;
      }
      case "selections": {
        title = "Selection Report";
        const items = await findPaged("application", { where: { status: "SELECTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title }));
        break;
      }
      case "rejections": {
        title = "Rejection Report";
        const items = await findPaged("application", { where: { status: "REJECTED" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title, appliedAt: a.appliedAt }));
        break;
      }
      case "on-hold": {
        title = "On Hold Report";
        const items = await findPaged("application", { where: { status: "ON_HOLD" }, include: { candidate: true, jobOpening: true } });
        rows = items.map((a) => ({ candidate: a.candidate.fullName, position: a.jobOpening.title, appliedAt: a.appliedAt }));
        break;
      }
      case "offers": {
        title = "Offer Letter Report";
        const items = await findPaged("offerLetter", { include: { application: { include: { candidate: true } } }, orderBy: { createdAt: "desc" } });
        rows = items.map((o) => ({ candidate: o.application.candidate.fullName, designation: o.designation, ctc: o.ctc, status: o.status, sentAt: o.sentAt }));
        break;
      }
      case "pending-documents": {
        title = "Pending Document Report";
        const items = await findPaged("candidateDocument", { where: { status: { not: "ACCEPTED" } }, include: { category: true, application: { include: { candidate: true } } } });
        rows = items.map((d) => ({ candidate: d.application.candidate.fullName, category: d.category.name, status: d.status, application: d.application.applicationCode }));
        break;
      }
      case "ai-rankings": {
        title = "AI Ranking Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        const items = await findPaged("candidateJobMatch", { where, include: { candidate: true, jobOpening: true }, orderBy: { overallScore: "desc" } });
        rows = items.map((m) => ({ candidate: m.candidate.fullName, position: m.jobOpening.title, overallScore: m.overallScore, skillScore: m.skillScore, experienceScore: m.experienceScore, qualificationScore: m.qualificationScore }));
        break;
      }
      case "skill-gap": {
        title = "Skill Gap Report";
        const where: any = {};
        if (jobOpeningId) where.jobOpeningId = jobOpeningId;
        const items = await findPaged("candidateJobMatch", { where, include: { candidate: true, jobOpening: true } });
        const gapCounts: Record<string, number> = {};
        for (const m of items) {
          const gaps = Array.isArray(m.gaps) ? m.gaps.filter((g: unknown): g is string => typeof g === "string" && Boolean(g.trim())) : [];
          for (const g of gaps) gapCounts[g] = (gapCounts[g] || 0) + 1;
        }
        const allGaps = Object.entries(gapCounts).map(([skill, count]) => ({ skill, candidateCount: count }));
        rows = pageRows(allGaps);
        totalRows = allGaps.length;
        break;
      }
      case "vacancies": {
        title = "Vacancy Report";
        const items = await findPaged("jobOpening", { where: { departmentId }, include: { department: true }, orderBy: { createdAt: "desc" } });
        rows = items.map((o) => ({ jobCode: o.jobCode, title: o.title, department: o.department?.name, positions: o.positions, status: o.status, deadline: o.deadline }));
        break;
      }
    }

    const fileName = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      return ok(res, {
        type,
        title,
        count: totalRows || rows.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil((totalRows || rows.length) / pageSize)),
        rows,
      });
    }
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
      const filterParts = [
        from ? `From ${from.toLocaleDateString()}` : "",
        to ? `To ${to.toLocaleDateString()}` : "",
        departmentId ? `Department ID ${departmentId}` : "",
        jobOpeningId ? `Job Opening ID ${jobOpeningId}` : "",
        status ? `Status ${status}` : "",
      ].filter(Boolean);
      const buffer = await buildPdf(rows, title, { filters: filterParts, total: totalRows || rows.length });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
      return res.send(buffer);
    }
    throw ApiError.badRequest("Unsupported format. Use json, csv, excel, or pdf.");
  }),
);

export default router;
