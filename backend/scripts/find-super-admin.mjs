import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function main() {
  const rows = await sql.query("SELECT id, email FROM emc_talent.users WHERE email = $1 LIMIT 1", ["subhambehera2023@gift.edu.in"]);
  console.log(rows);
}
main().catch((err) => { console.error(String(err?.message ?? err)); process.exit(1); });
