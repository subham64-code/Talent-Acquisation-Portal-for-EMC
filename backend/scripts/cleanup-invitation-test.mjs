import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
const sql = neon(url);
async function main() {
  const rows = await sql.query(
    `select i.id, i."employeeId", e."officialEmail", e."fullName", i."usedAt"
     from emc_talent.employee_update_invitations i
     join emc_talent.employees e on e.id = i."employeeId"
     where e."officialEmail" = $1`,
    ["subhambehera2023@gift.edu.in"],
  );
  console.log("found", JSON.stringify(rows, null, 2));
  for (const row of rows) {
    await sql.query('delete from emc_talent.employees where id = $1', [row.employeeId]);
    console.log("deleted", row.employeeId);
  }
}
main().catch((error) => { console.error(String(error?.message ?? error)); process.exit(1); });
