import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select o.id, o."applicationId", o.status, o."pdfFileId", o."createdAt", o.designation, a."applicationCode", c."fullName" from emc_talent.offer_letters o join emc_talent.applications a on a.id = o."applicationId" join emc_talent.candidates c on c.id = a."candidateId" order by o."createdAt" desc limit 10');
console.log(rows);
