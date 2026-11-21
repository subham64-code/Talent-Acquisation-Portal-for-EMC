import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok } from "../utils/http";
import { authenticate, optionalAuthenticate, requireAuth, requirePermission } from "../middleware/auth";
import { verifyPurposeToken, signPurposeToken } from "../utils/jwt";
import { readStoredFile, STORAGE_BUCKETS } from "../storage/index";
import { env } from "../config/env";
import { contentDispositionFilename } from "../utils/crypto";

const router = express.Router();

async function authorizeFileAccess(req: express.Request, file: any): Promise<boolean> {
  const auth = req.auth;
  if (auth?.type === "HR") {
    const perms = ["databank.view", "applications.view", "employees.view", "documents.view", "offers.view"];
    if (perms.some((p) => auth.permissions.includes(p))) return true;
  }
  if (auth?.type === "CANDIDATE" && file.ownerType === "CANDIDATE" && file.ownerId === auth.candidateId) return true;
  const token = (req.query.token as string | undefined);
  if (token) {
    try {
      const decoded = verifyPurposeToken(token, "FILE_ACCESS") as unknown as { fileId: string };
      if (decoded.fileId === file.id) return true;
    } catch {}
    try {
      const decoded = verifyPurposeToken(token, "DOC_UPLOAD") as unknown as { candidateId: string; applicationId: string };
      if (auth?.type === "CANDIDATE" && auth.candidateId === decoded.candidateId && file.ownerType === "CANDIDATE" && file.ownerId === decoded.candidateId) return true;
    } catch {}
  }
  return false;
}

router.get(
  "/:id",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file) throw ApiError.notFound("File not found.");
    if (!(await authorizeFileAccess(req, file))) throw ApiError.forbidden("You are not authorized to access this file.");
    const buffer = await readStoredFile(file);
    const inline = /^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.mimeType);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", contentDispositionFilename(file.originalName, inline ? "inline" : "attachment"));
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  }),
);

router.get(
  "/:id/portal",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file) throw ApiError.notFound("File not found.");
    const token = req.query.token as string | undefined;
    if (!token) throw ApiError.unauthorized("A secure access token is required.");
    let ok = false;
    try {
      const decoded = verifyPurposeToken(token, "DOC_UPLOAD") as unknown as { candidateId: string };
      if (file.key.startsWith(STORAGE_BUCKETS.ONBOARDING + "/") && file.ownerType === "CANDIDATE" && file.ownerId === decoded.candidateId) ok = true;
    } catch {}
    if (!ok) throw ApiError.forbidden("Invalid or expired access token.");
    const buffer = await readStoredFile(file);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", contentDispositionFilename(file.originalName, "inline"));
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  }),
);

router.post(
  "/:id/access-token",
  authenticate,
  requireAuth("HR"),
  requirePermission("documents.view", "databank.view", "applications.view", "employees.view", "offers.view"),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file) throw ApiError.notFound("File not found.");
    // Always issue an app-scoped token as well, so the browser never has to rely
    // on a cross-origin direct URL to open private company documents.
    const token = signPurposeToken({ fileId: file.id }, "FILE_ACCESS", "1h");
    return ok(res, { token, url: `${env.publicApiUrl}/api/v1/files/${id}?token=${token}`, presigned: false, expiresIn: 3600, s3: file.provider === "s3" });
  }),
);

export default router;
