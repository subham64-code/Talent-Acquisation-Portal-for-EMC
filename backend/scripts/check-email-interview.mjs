import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const id = "cmwka2zuz0001vy0015eye1qm";
const inspect = await sql.query('select "toEmail", "templateKey", status, error from emc_talent.email_logs where metadata->>\'interviewId\' = $1 order by "createdAt"', [id]);
console.log(inspect);
