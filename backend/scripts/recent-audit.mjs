import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select action, "createdAt" from emc_talent.audit_logs order by "createdAt" desc limit 8');
console.log(rows);
