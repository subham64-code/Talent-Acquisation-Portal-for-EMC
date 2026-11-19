import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function main() {
  for (const table of ["departments","designations","employment_types"]) {
    const rows = await sql.query(`select count(*)::int as count from emc_talent.${table}`);
    console.log(table, rows[0]);
  }
  const all = await sql.query('select id,name,is_active as "isActive" from emc_talent.designations order by name');
  console.log(all);
}
main().catch(err => { console.error(err); process.exit(1); });
