import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select a."applicationCode", a.status, i.id as "interviewId", i.round, i.\"interviewerName\", f.id as "feedbackId", f.score, f.feedback, f.recommendation from emc_talent.interviews i join emc_talent.applications a on a.id=i."applicationId" left join emc_talent.interview_feedback f on f."interviewId"=i.id where a."applicationCode" in (\'APPLXPGFLY5P\',\'APPLQ6136A9E\',\'APPLQH2TPI8K\',\'APPKMG795WAF\') order by i."createdAt" desc');
console.log(rows);
