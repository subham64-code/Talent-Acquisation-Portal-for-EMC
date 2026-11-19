import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select id, name, "departmentId" from emc_talent.programs order by name');
console.log(rows);
