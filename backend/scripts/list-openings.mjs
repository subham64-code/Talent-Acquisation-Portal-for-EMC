import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function main() {
  const rows = await sql.query('select count(*)::int as count from emc_talent.job_openings');
  console.log('job_openings', rows);
  const titles = await sql.query('select distinct title from emc_talent.job_openings order by title limit 100');
  console.log(titles);
}
main().catch(err => { console.error(err); process.exit(1); });
