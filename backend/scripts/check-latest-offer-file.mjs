import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query("select id, key, provider, size, \"mimeType\", \"originalName\" from emc_talent.stored_files where id = \'cmwm0vd6k0001vypkf0xei9rh\'");
console.log(rows);
