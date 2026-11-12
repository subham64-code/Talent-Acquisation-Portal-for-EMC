import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(`[${new Date().toISOString()}] ${err.message}`, env.isProd ? "" : err.stack);

  // Malformed request bodies (express.json / urlencoded failures) are client errors.
  const errAny = err as any;
  if (errAny?.type === "entity.parse.failed" || errAny?.type === "entity.too.large" || errAny?.status === 400) {
    return res.status(400).json({
      success: false,
      error: {
        code: errAny?.type === "entity.too.large" ? "PAYLOAD_TOO_LARGE" : "BAD_JSON",
        message: errAny?.type === "entity.too.large" ? "The request payload is too large." : "Malformed request body — please check the JSON you sent.",
      },
    });
  }

  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { success: false, error: { code: err.code, message: err.message } };
    if (err.details && env.isDev) (body.error as Record<string, unknown>).details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Translate Prisma foreign key violations into an actionable message.
  const code = (err as { code?: string }).code;
  if (code === "P2003") {
    const meta = (err as { meta?: { field_name?: string; model_name?: string } }).meta;
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REFERENCE",
        message: `Invalid ${meta?.field_name ?? "reference"} supplied${meta?.model_name ? ` for ${meta.model_name}` : ""}. Please select a valid existing record.`,
      },
    });
  }
  if (code === "P2002") {
    return res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "A record with these unique details already exists." },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: env.isProd ? "INTERNAL_ERROR" : "ERROR",
      message: env.isProd ? "Something went wrong." : err.message || "Internal server error",
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." } });
}
