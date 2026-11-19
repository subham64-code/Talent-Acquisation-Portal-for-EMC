import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query("select is_nullable from information_schema.columns where table_schema='emc_talent' and table_name='job_openings' and column_name='departmentId'");
console.log(rows);
