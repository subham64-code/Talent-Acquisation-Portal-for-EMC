import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('select id, key, provider, size, "mimeType", "originalName" from emc_talent.stored_files where id = ANY($1::text[]) order by "createdAt" desc', [[
  'cmwkoirhx002avye4ceb0xu11',
  'cmwkct3vw000pvybgvwv5vcuh'
]]);
console.log(rows);
