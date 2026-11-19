import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select a."applicationCode", a.status, a.id "applicationId", i.id as "interviewId", i."interviewType", i."scheduledAt", i."interviewers", i."createdAt", f.id as "feedbackId", f.comments, f.recommendation, f.score from emc_talent.interviews i join emc_talent.applications a on a.id = i."applicationId" left join emc_talent.interview_feedback f on f."interviewId" = i.id where a."applicationCode" in (\'APPLXPGFLY5P\',\'APPLQ6136A9E\',\'APPLQ6136A9E\') order by i."createdAt" desc');
console.log(rows);
