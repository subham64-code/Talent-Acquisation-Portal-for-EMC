import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function main() {
  const deps = await sql.query('select name, "isActive" from emc_talent.departments order by name');
  console.log('departments', deps);
  const des = await sql.query('select name, "isActive", "departmentId" from emc_talent.designations order by name');
  console.log('designations', des);
}
main().catch(err => { console.error(err); process.exit(1); });
