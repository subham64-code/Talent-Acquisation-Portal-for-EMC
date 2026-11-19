import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select "toEmail","templateKey",status,error,"createdAt",metadata from emc_talent.email_logs where "templateKey" like \'offer%\' order by "createdAt" desc limit 20');
console.log(rows);
