import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
const sql = neon(url);
async function main() {
  const fileId = process.argv[2];
  const rows = await sql.query(
    `select id, "originalName", "ownerType", "ownerId", "storagePath" from emc_talent.stored_files where id = $1`,
    [fileId],
  );
  console.log(rows);
}
main().catch((error) => { console.error(String(error?.message ?? error)); process.exit(1); });
