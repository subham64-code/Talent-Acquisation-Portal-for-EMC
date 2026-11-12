import type { Request } from "express";

export interface PaginationInput {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
}

export function getPagination(req: Request, defaultPageSize = 20, maxPageSize = 100): PaginationInput {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || defaultPageSize;
  const pageSize = Math.min(maxPageSize, Math.max(1, requested));
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search: search || undefined,
  };
}

export function getSort(
  req: Request,
  allowed: string[],
  fallback: Record<string, "asc" | "desc">,
): Record<string, "asc" | "desc"> {
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  if (allowed.includes(sortBy)) {
    return { [sortBy]: sortDir };
  }
  return fallback;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}
