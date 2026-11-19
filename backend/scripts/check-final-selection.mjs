import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select "applicationCode", status, "finalSelectionSalary", "finalSelectionExpectedSalary", "finalSelectionNote", "hrRemarks", "updatedAt" from emc_talent.applications where status=\'SELECTED\' order by "updatedAt" desc limit 10');
console.log(rows);
