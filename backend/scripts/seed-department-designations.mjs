import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const before = await sql.query('select count(*)::int as count from emc_talent.designations');
const result = await sql.query(`insert into emc_talent.designations (id, name, "departmentId", "isActive")
select md5(random()::text || clock_timestamp()::text || d.id), d.name, d.id, true
from emc_talent.departments d
on conflict ("departmentId", name) do nothing
returning id`);
const after = await sql.query('select count(*)::int as count from emc_talent.designations');
console.log({ before: before[0].count, added: result.length, after: after[0].count });
