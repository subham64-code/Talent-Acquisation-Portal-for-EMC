import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query("select * from emc_talent.stored_files order by \"createdAt\" desc limit 10");
for (const row of rows) console.log(row);
