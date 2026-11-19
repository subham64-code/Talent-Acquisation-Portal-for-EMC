import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const before = await sql.query("select count(*)::int as count from emc_talent.programs");
  await sql.query('ALTER TABLE emc_talent.programs ADD COLUMN IF NOT EXISTS "departmentId" TEXT');
  await sql.query('ALTER TABLE emc_talent.programs DROP CONSTRAINT IF EXISTS programs_departmentId_fkey');
  await sql.query('ALTER TABLE emc_talent.programs ADD CONSTRAINT programs_departmentId_fkey FOREIGN KEY ("departmentId") REFERENCES emc_talent.departments(id) ON DELETE SET NULL');
  await sql.query('CREATE INDEX IF NOT EXISTS "programs_departmentId_idx" ON emc_talent.programs("departmentId")');
  const after = await sql.query("select count(*)::int as count from emc_talent.programs");
  const cols = await sql.query("select column_name from information_schema.columns where table_schema='emc_talent' and table_name='programs' order by ordinal_position");
  console.log({ before: before[0].count, after: after[0].count });
  console.log(cols.map((row) => row.column_name));
}
main().catch((err) => { console.error(err); process.exit(1); });
