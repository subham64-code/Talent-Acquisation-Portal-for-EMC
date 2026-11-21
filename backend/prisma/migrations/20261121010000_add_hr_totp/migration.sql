-- Add TOTP (RFC 6238) authentication support for HR accounts.
-- Additive and data-preserving: no columns, rows or tables are dropped.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totpEnrollmentPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totpLastUsedStep" BIGINT,
  ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedTotpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_totpEnabled_idx" ON "users"("totpEnabled");

CREATE TABLE IF NOT EXISTS "totp_enrollments" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "totp_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "totp_enrollments_tokenHash_key" ON "totp_enrollments"("tokenHash");
CREATE INDEX IF NOT EXISTS "totp_enrollments_userId_idx" ON "totp_enrollments"("userId");
CREATE INDEX IF NOT EXISTS "totp_enrollments_expiresAt_idx" ON "totp_enrollments"("expiresAt");

ALTER TABLE "totp_enrollments"
  DROP CONSTRAINT IF EXISTS "totp_enrollments_userId_fkey",
  ADD CONSTRAINT "totp_enrollments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reverse (manual rollback, intentionally not auto-executed):
-- DROP TABLE IF EXISTS "totp_enrollments";
-- DROP INDEX IF EXISTS "users_totpEnabled_idx";
-- ALTER TABLE "users"
--   DROP COLUMN IF EXISTS "totpSecretEncrypted",
--   DROP COLUMN IF EXISTS "totpEnabled",
--   DROP COLUMN IF EXISTS "totpEnrollmentPending",
--   DROP COLUMN IF EXISTS "totpLastUsedStep",
--   DROP COLUMN IF EXISTS "totpEnabledAt",
--   DROP COLUMN IF EXISTS "failedTotpAttempts",
--   DROP COLUMN IF EXISTS "lockedUntil";
