import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function main() {
  for (const email of ["bypass-test-123@example.com", "bypass-test@example.com", "bypass-test-send@example.com"]) {
    const rows = await sql.query("select id from emc_talent.employees where \"officialEmail\" = $1", [email]);
    for (const row of rows) {
      await sql.query("delete from emc_talent.employee_update_invitations where \"employeeId\" = $1", [row.id]);
      await sql.query("delete from emc_talent.employees where id = $1", [row.id]);
      console.log("deleted", email, row.id);
    }
  }
}
main().catch(err => { console.error(String(err?.message ?? err)); process.exit(1); });
