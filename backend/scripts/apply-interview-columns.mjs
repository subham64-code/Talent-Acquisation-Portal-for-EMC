import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const sql = neon(url);
async function main() {
  const statements = [
    'ALTER TABLE "emc_talent"."interviews" ADD COLUMN IF NOT EXISTS "interviewerType" TEXT;',
    'ALTER TABLE "emc_talent"."interviews" ADD COLUMN IF NOT EXISTS "interviewerMetadata" JSONB;',
  ];
  for (const text of statements) {
    process.stdout.write(text + "\n");
    await sql.query(text, []);
  }
  console.log("done");
}
main().catch((error) => { console.error(String(error?.message ?? error)); process.exit(1); });
