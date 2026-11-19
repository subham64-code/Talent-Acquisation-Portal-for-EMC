import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select "applicationCode", status, "aiMatchScore", "finalSelectionSalary", "finalSelectionExpectedSalary", "finalSelectionNote", "hrRemarks", "updatedAt" from emc_talent.applications order by "updatedAt" desc limit 5');
console.log(rows);
