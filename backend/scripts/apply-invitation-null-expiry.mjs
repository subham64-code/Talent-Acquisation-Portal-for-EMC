import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql.query('ALTER TABLE emc_talent.employee_update_invitations ALTER COLUMN "expiresAt" DROP NOT NULL');
  const updated = await sql.query('UPDATE emc_talent.employee_update_invitations SET "expiresAt" = NULL WHERE "expiresAt" IS NOT NULL RETURNING id');
  console.log(`backfilled rows: ${updated.length}`);
  const cols = await sql.query("select column_name, is_nullable from information_schema.columns where table_schema='emc_talent' and table_name='employee_update_invitations' and column_name='expiresAt'");
  console.log(cols);
}
main().catch((err) => { console.error(err); process.exit(1); });
