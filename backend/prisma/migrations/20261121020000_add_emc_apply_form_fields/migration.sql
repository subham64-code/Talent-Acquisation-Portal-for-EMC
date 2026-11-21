-- Additive migration: stores the public EMC careers application form verbatim.
-- Existing rows are untouched (all new columns are nullable).
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "job_opening_id" TEXT,
  ADD COLUMN IF NOT EXISTS "job_title" TEXT,
  ADD COLUMN IF NOT EXISTS "full_name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "date_of_birth" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "current_location" TEXT,
  ADD COLUMN IF NOT EXISTS "current_address" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "highest_qualification" TEXT,
  ADD COLUMN IF NOT EXISTS "course" TEXT,
  ADD COLUMN IF NOT EXISTS "specialization_stream" TEXT,
  ADD COLUMN IF NOT EXISTS "college" TEXT,
  ADD COLUMN IF NOT EXISTS "passing_year" TEXT,
  ADD COLUMN IF NOT EXISTS "percentage" TEXT,
  ADD COLUMN IF NOT EXISTS "total_experience" TEXT,
  ADD COLUMN IF NOT EXISTS "relevant_experience" TEXT,
  ADD COLUMN IF NOT EXISTS "current_company" TEXT,
  ADD COLUMN IF NOT EXISTS "current_designation" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "work_specialization" TEXT,
  ADD COLUMN IF NOT EXISTS "technical_skills" TEXT,
  ADD COLUMN IF NOT EXISTS "professional_skills" TEXT,
  ADD COLUMN IF NOT EXISTS "employment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "expected_salary" TEXT,
  ADD COLUMN IF NOT EXISTS "notice_period" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedin" TEXT,
  ADD COLUMN IF NOT EXISTS "cover_letter" TEXT,
  ADD COLUMN IF NOT EXISTS "additional_info" TEXT,
  ADD COLUMN IF NOT EXISTS "cv_file_name" TEXT;

CREATE INDEX IF NOT EXISTS "applications_emc_email_idx" ON "applications"("email");
CREATE INDEX IF NOT EXISTS "applications_emc_job_opening_id_idx" ON "applications"("job_opening_id");
