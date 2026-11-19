import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const apps = await sql.query(`select c."additionalInfo" as candidate_additional, a."coverLetter", a."hrRemarks"
from emc_talent.applications a join emc_talent.candidates c on c.id=a."candidateId" order by a."createdAt" desc limit 10`);
for (const row of apps) console.log(row);
