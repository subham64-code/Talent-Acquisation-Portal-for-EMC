import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select "applicationCode", status, "createdAt", "finalSelectionSalary", "finalSelectionExpectedSalary", "finalSelectionNote", "hrRemarks", "aiMatchScore" from emc_talent.applications order by "createdAt" desc limit 10');
console.log(rows);
