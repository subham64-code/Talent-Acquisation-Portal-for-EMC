import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const sql = neon(url);
async function main() {
  const statements = [
    'ALTER TABLE "emc_talent"."applications" ADD COLUMN IF NOT EXISTS "finalSelectionSalary" DOUBLE PRECISION;',
    'ALTER TABLE "emc_talent"."applications" ADD COLUMN IF NOT EXISTS "finalSelectionExpectedSalary" DOUBLE PRECISION;',
    'ALTER TABLE "emc_talent"."applications" ADD COLUMN IF NOT EXISTS "finalSelectionNote" TEXT;',
  ];
  for (const text of statements) {
    console.log(text);
    await sql.query(text, []);
  }
  console.log("done");
}
main().catch((error) => { console.error(String(error?.message ?? error)); process.exit(1); });
