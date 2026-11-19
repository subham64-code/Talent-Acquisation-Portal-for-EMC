import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const token = process.argv[2];
if (!token) throw new Error("Pass the token.");
import { createHash } from "crypto";
const sha = createHash("sha256").update(token).digest("hex");
async function main() {
  const rows = await sql.query("select id, \"employeeId\", \"expiresAt\", \"usedAt\", \"createdAt\", left(\"tokenHash\", 12) as \"tokenHashPrefix\", \"submissionStatus\" from emc_talent.employee_update_invitations where \"tokenHash\" = $1", [sha]);
  console.log("sha-found", rows);
  const rows2 = await sql.query("select count(*)::int as c from emc_talent.employee_update_invitations", []);
  console.log("count", rows2);
  const rows3 = await sql.query("select id, \"employeeId\", \"expiresAt\", \"usedAt\", \"createdAt\" from emc_talent.employee_update_invitations order by \"createdAt\" desc limit 5", []);
  console.log("recent", rows3);
}
main().catch(err => { console.error(err); process.exit(1); });
