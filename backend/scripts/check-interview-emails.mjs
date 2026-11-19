import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const interviews = await sql.query('select id, "applicationId", round, "interviewerName", "interviewerEmail", "interviewerMetadata", "createdAt" from emc_talent.interviews order by "createdAt" desc limit 10');
console.log("interviews", interviews);
const logs = await sql.query('select id, "toEmail", "templateKey", status, error, "createdAt", metadata from emc_talent.email_logs where "templateKey" like \'interview%\' order by "createdAt" desc limit 30');
console.log("logs", logs);
