// Applies the pending schema changes without opening TCP 5432.
// Neon is reachable over HTTPS (443) in this environment, so we use the SQL-over-HTTP
// endpoint via @neondatabase/serverless and run idempotent DDL.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(url);

async function run(label, text) {
  process.stdout.write(`Applying ${label}... `);
  try {
    await sql.query(text, []);
    process.stdout.write("ok\n");
  } catch (error) {
    const message = String((error && error.message) || error);
    if (/already exists/i.test(message)) {
      process.stdout.write("already exists\n");
      return;
    }
    console.error("FAILED");
    console.error(message);
    process.exitCode = 1;
    process.exit(1);
  }
}

const statements = [
  ["invitation status column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'SENT\';'],
  ["index on employee_update_invitations(status)", 'CREATE INDEX IF NOT EXISTS "employee_update_invitations_status_idx" ON "emc_talent"."employee_update_invitations"("status");'],
  ["invitation openedAt column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);'],
  ["invitation draft column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "draft" JSONB;'],
  ["invitation draftUpdatedAt column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "draftUpdatedAt" TIMESTAMP(3);'],
  ["invitation submissionStatus column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "submissionStatus" TEXT;'],
  ["invitation submissionRejection column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "submissionRejection" TEXT;'],
  ["invitation reviewedAt column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);'],
  ["invitation reviewedById column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;'],
  ["invitation reminderCount column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;'],
  ["invitation lastReminderSentAt column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "lastReminderSentAt" TIMESTAMP(3);'],
  ["invitation tokenRenewedAt column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "tokenRenewedAt" TIMESTAMP(3);'],
  ["invitation tokenRenewalCount column", 'ALTER TABLE "emc_talent"."employee_update_invitations" ADD COLUMN IF NOT EXISTS "tokenRenewalCount" INTEGER NOT NULL DEFAULT 0;'],
  ["index on employee_update_invitations(submissionStatus)", 'CREATE INDEX IF NOT EXISTS "employee_update_invitations_submissionStatus_idx" ON "emc_talent"."employee_update_invitations"("submissionStatus");'],
  ["employee_invite_reminders table", 'CREATE TABLE IF NOT EXISTS "emc_talent"."employee_invite_reminders" ("id" TEXT PRIMARY KEY, "invitationId" TEXT NOT NULL REFERENCES "emc_talent"."employee_update_invitations"("id") ON DELETE CASCADE, "purpose" TEXT NOT NULL, "profileCompletion" INTEGER NOT NULL DEFAULT 0, "renewedToken" BOOLEAN NOT NULL DEFAULT false, "sentAt" TIMESTAMP(3) NOT NULL DEFAULT now());'],
  ["index on employee_invite_reminders(invitationId)", 'CREATE INDEX IF NOT EXISTS "employee_invite_reminders_invitationId_idx" ON "emc_talent"."employee_invite_reminders"("invitationId");'],
];

for (const [label, text] of statements) {
  await run(label, text);
}

console.log("Schema changes applied.");
