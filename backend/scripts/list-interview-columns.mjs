import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query("select table_name, column_name from information_schema.columns where table_schema='emc_talent' and table_name in ('interviews','interview_feedback') order by table_name, ordinal_position");
console.log(rows);
