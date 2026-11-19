import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select id, round, "interviewerMetadata" from emc_talent.interviews where id = \'cmwka2zuz0001vy0015eye1qm\' limit 1');
console.log(JSON.stringify(rows[0], null, 2));
const bad = await sql.query('select row_to_json(r) from (select id, round, "interviewerMetadata" from emc_talent.interviews where id = \'cmwka2zuz0001vy0015eye1qm\' limit 1) r');
console.log(bad);
