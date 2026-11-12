import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok, paginated } from "../utils/http";
import { getPagination } from "../utils/pagination";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { cached, CACHE_KEYS } from "../lib/cache";
import { env } from "../config/env";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr, requirePermission("databank.view"));

type DatabankRow = {
  id: string;
  code: string;
  name: string;
  email: string;
  mobile: string | null;
  departmentId: string | null;
  department: string | null;
  designation: string | null;
  totalExperience: number | null;
  relevantExperience: number | null;
  qualification: string | null;
  skills: string[];
  category: "EXISTING" | "FORMER" | "PIPELINE" | "ON_HOLD";
  status: string;
  cv: { id: string; originalName: string; mimeType: string } | null;
  lastUpdated: Date;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take, search } = getPagination(req);
    const category = req.query.category as string | undefined;
    const skillsFilter = req.query.skills ? String(req.query.skills).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    const departmentFilter = req.query.departmentId as string | undefined;
    const experienceMin = req.query.experienceMin ? Number(req.query.experienceMin) : undefined;
    const experienceMax = req.query.experienceMax ? Number(req.query.experienceMax) : undefined;

    const cacheKey = CACHE_KEYS.databank(page, pageSize, [
      category ?? "-", search ?? "-", skillsFilter.join(","), experienceMin ?? "-", experienceMax ?? "-",
    ].join("|"));

    const filtered = await cached(cacheKey, env.cacheTtlSeconds, async () => {
      const [onHoldApps] = await Promise.all([
        prisma.application.findMany({ where: { status: "ON_HOLD" }, select: { candidateId: true }, distinct: ["candidateId"] }),
      ]);
      const onHoldIds = new Set(onHoldApps.map((a) => a.candidateId));

      const [employees, candidates] = await Promise.all([
        prisma.employee.findMany({
          include: { department: true, designation: true, skills: { include: { skill: true } }, cvFile: true },
        }),
        prisma.candidate.findMany({
          include: { skills: { include: { skill: true } }, cvFile: true },
        }),
      ]);

      const rows: DatabankRow[] = [];

      for (const e of employees) {
        if (e.status !== "EXISTING" && e.status !== "FORMER") continue;
        if (category && e.status !== category) continue;
        rows.push({
          id: e.id, code: e.employeeCode, name: e.fullName, email: e.officialEmail, mobile: e.mobile,
          departmentId: e.departmentId ?? null,
          department: e.department?.name ?? null, designation: e.designation?.name ?? null,
          totalExperience: e.totalExperience, relevantExperience: e.relevantExperience,
          qualification: e.qualification, skills: e.skills.map((s) => s.skill.name),
          category: e.status as DatabankRow["category"], status: e.status,
          cv: e.cvFile ? { id: e.cvFile.id, originalName: e.cvFile.originalName, mimeType: e.cvFile.mimeType } : null,
          lastUpdated: e.updatedAt,
        });
      }

      for (const c of candidates) {
        const cat = onHoldIds.has(c.id) ? "ON_HOLD" : "PIPELINE";
        if (category && cat !== category) continue;
        rows.push({
          id: c.id, code: c.candidateCode, name: c.fullName, email: c.email, mobile: c.mobile,
          departmentId: null, department: null, designation: c.currentDesignation, totalExperience: c.totalExperience,
          relevantExperience: c.relevantExperience, qualification: c.qualification,
          skills: c.skills.map((s) => s.skill.name),
          category: cat, status: c.status,
          cv: c.cvFile ? { id: c.cvFile.id, originalName: c.cvFile.originalName, mimeType: c.cvFile.mimeType } : null,
          lastUpdated: c.updatedAt,
        });
      }

      let result = rows;
      if (search) {
        const s = search.toLowerCase();
        result = result.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || r.code.toLowerCase().includes(s));
      }
      if (skillsFilter.length) {
        result = result.filter((r) => skillsFilter.some((sk) => r.skills.some((sk2) => sk2.toLowerCase().includes(sk))));
      }
      if (departmentFilter) {
        result = result.filter((r) => r.departmentId === departmentFilter);
      }
      if (experienceMin !== undefined) result = result.filter((r) => (r.totalExperience ?? 0) >= experienceMin);
      if (experienceMax !== undefined) result = result.filter((r) => (r.totalExperience ?? 0) <= experienceMax);

      return result;
    });

    const total = filtered.length;
    const items = filtered.slice(skip, skip + take);
    return ok(res, paginated(items, total, page, pageSize));
  }),
);

router.get("/categories", asyncHandler(async (_req, res) => {
  return ok(res, { categories: [
    { key: "EXISTING", label: "Existing Employees" },
    { key: "FORMER", label: "Former Employees" },
    { key: "PIPELINE", label: "Pipeline Candidates" },
    { key: "ON_HOLD", label: "On Hold Applications" },
  ] });
}));

export default router;
