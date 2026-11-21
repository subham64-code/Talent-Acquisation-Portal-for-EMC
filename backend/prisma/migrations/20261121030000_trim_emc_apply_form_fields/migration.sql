-- Align the applications table with the original EMC careers apply form.
-- Data-preserving: adds the two renamed form columns and removes only the extra
-- columns that were added for the previously expanded (now removed) form.
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "job_id" TEXT,
  ADD COLUMN IF NOT EXISTS "experience" TEXT;

UPDATE "applications" SET "job_id" = "job_opening_id" WHERE "job_id" IS NULL;
UPDATE "applications" SET "experience" = "total_experience" WHERE "experience" IS NULL;

DROP INDEX IF EXISTS "applications_emc_job_opening_id_idx";

ALTER TABLE "applications"
  DROP COLUMN IF EXISTS "total_experience",
  DROP COLUMN IF EXISTS "date_of_birth",
  DROP COLUMN IF EXISTS "gender",
  DROP COLUMN IF EXISTS "current_location",
  DROP COLUMN IF EXISTS "current_address",
  DROP COLUMN IF EXISTS "country",
  DROP COLUMN IF EXISTS "state",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "highest_qualification",
  DROP COLUMN IF EXISTS "course",
  DROP COLUMN IF EXISTS "specialization_stream",
  DROP COLUMN IF EXISTS "college",
  DROP COLUMN IF EXISTS "passing_year",
  DROP COLUMN IF EXISTS "percentage",
  DROP COLUMN IF EXISTS "relevant_experience",
  DROP COLUMN IF EXISTS "current_company",
  DROP COLUMN IF EXISTS "current_designation",
  DROP COLUMN IF EXISTS "department",
  DROP COLUMN IF EXISTS "work_specialization",
  DROP COLUMN IF EXISTS "technical_skills",
  DROP COLUMN IF EXISTS "professional_skills",
  DROP COLUMN IF EXISTS "employment_status",
  DROP COLUMN IF EXISTS "expected_salary",
  DROP COLUMN IF EXISTS "notice_period",
  DROP COLUMN IF EXISTS "linkedin",
  DROP COLUMN IF EXISTS "additional_info";

CREATE INDEX IF NOT EXISTS "applications_emc_job_id_idx" ON "applications"("job_id");
