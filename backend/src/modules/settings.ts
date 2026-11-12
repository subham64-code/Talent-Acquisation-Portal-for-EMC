import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ok } from "../utils/http";
import { authenticate, requireAuth, requireHr, requirePermission } from "../middleware/auth";
import { storageStatus, storageBucketSummary } from "../storage/index";
import { cacheStats } from "../lib/cache";
import { env } from "../config/env";

const router = express.Router();
router.use(authenticate, requireAuth("HR"), requireHr);

const WEIGHT_KEYS = ["skills", "experience", "qualification", "domain", "certification"] as const;

const weightsSchema = z.object({
  skills: z.coerce.number().nonnegative(),
  experience: z.coerce.number().nonnegative(),
  qualification: z.coerce.number().nonnegative(),
  domain: z.coerce.number().nonnegative(),
  certification: z.coerce.number().nonnegative(),
});

router.get(
  "/weights",
  requirePermission("ai.view"),
  asyncHandler(async (_req, res) => {
    const stored = await prisma.integrationSetting.findUnique({ where: { key: "ai_weights" } });
    const weights = stored ? (stored.value as Record<string, number>) : env.aiWeights;
    return ok(res, { weights, valid: Object.values(weights).reduce((a, b) => a + b, 0) === 100 });
  }),
);

router.put(
  "/weights",
  requirePermission("settings.manage"),
  asyncHandler(async (req, res) => {
    const parsed = weightsSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid weights.", parsed.error.flatten());
    const weights = parsed.data;
    const total = WEIGHT_KEYS.reduce((a, k) => a + weights[k], 0);
    if (total !== 100) throw ApiError.badRequest("Weights must total 100.");
    await prisma.integrationSetting.upsert({
      where: { key: "ai_weights" },
      update: { value: weights },
      create: { key: "ai_weights", value: weights },
    });
    return ok(res, { weights, message: "AI scoring weights saved." });
  }),
);

router.get(
  "/integration-status",
  requirePermission("settings.manage"),
  asyncHandler(async (_req, res) => {
    const storage = storageStatus();
    const cacheInfo = cacheStats();
    return ok(res, {
      database: { provider: "neon-postgresql", cloud: true },
      storage,
      googleDrive: storage.provider === "google_drive" && storage.configured,
      googleSheets: env.googleSheetsEnabled && Boolean(env.googleSheetsSpreadsheetId),
      s3: storage.provider === "s3" && storage.configured,
      smtp: Boolean(env.smtpHost && env.smtpUser),
      cache: cacheInfo,
      ocr: env.ocrEnabled,
    });
  }),
);

/** Storage bucket usage for the IT administrator console. */
router.get(
  "/storage-buckets",
  requirePermission("users.reset"),
  asyncHandler(async (_req, res) => {
    const buckets = await storageBucketSummary();
    const totals = buckets.reduce(
      (acc, b) => ({ files: acc.files + b.files, bytes: acc.bytes + b.bytes }),
      { files: 0, bytes: 0 },
    );
    return ok(res, { buckets, totals, storage: storageStatus() });
  }),
);

export default router;
