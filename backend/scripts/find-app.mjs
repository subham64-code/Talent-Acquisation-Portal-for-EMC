import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select id from emc_talent.applications where "applicationCode" = \'APPLXPGFLY5P\'');
console.log(rows[0]);
