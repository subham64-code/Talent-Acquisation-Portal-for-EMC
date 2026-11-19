import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
const sql = neon(url);

async function main() {
  const rows = await sql.query(
    "select table_schema, table_name from information_schema.tables where table_name in ('employee_update_invitations','employee_invite_reminders') order by table_schema, table_name",
    [],
  );
  console.log(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
