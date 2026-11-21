-- Shared cache generation counters for multi-instance invalidation.
CREATE TABLE IF NOT EXISTS "cache_generations" (
  "namespace" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cache_generations_pkey" PRIMARY KEY ("namespace")
);

-- Additive, backward-compatible: existing rows keep NULL and continue to work.
-- Screening status is written by the AI screening engine so Pending / Processing /
-- Evaluated / Failed can be shown accurately instead of being inferred from a score.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "screening_status" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "screening_error" TEXT;

CREATE INDEX IF NOT EXISTS "applications_job_opening_id_screening_status_idx"
  ON "applications"("job_opening_id", "screening_status");

-- Background screening jobs. Each batch is persisted so the UI can poll progress
-- and a server restart can recover batches left in PROCESSING.
CREATE TABLE IF NOT EXISTS "ai_screening_jobs" (
  "id" TEXT NOT NULL,
  "job_opening_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "options" JSONB,
  "total" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "top_score" DOUBLE PRECISION,
  "error" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_screening_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_screening_jobs_job_opening_id_created_at_idx"
  ON "ai_screening_jobs"("job_opening_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_screening_jobs_status_idx"
  ON "ai_screening_jobs"("status");

ALTER TABLE "ai_screening_jobs" ADD CONSTRAINT "ai_screening_jobs_job_opening_id_fkey"
  FOREIGN KEY ("job_opening_id") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_screening_jobs" ADD CONSTRAINT "ai_screening_jobs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
