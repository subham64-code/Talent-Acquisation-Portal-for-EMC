// Local development PostgreSQL server (mirrors production PostgreSQL semantics).
// Production uses Neon PostgreSQL via DATABASE_URL; this helper only exists so the
// application can be run and tested locally without installing PostgreSQL.
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const port = Number(process.env.DEV_DB_PORT || 55432);
const user = process.env.DEV_DB_USER || "postgres";
const password = process.env.DEV_DB_PASSWORD || "postgres";
const database = process.env.DEV_DB_NAME || "emc";
const databaseDir = path.resolve(process.cwd(), process.env.DEV_DB_DIR || "./pgdata");

async function main() {
  fs.mkdirSync(databaseDir, { recursive: true });
  const alreadyInitialised = fs.existsSync(path.join(databaseDir, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error("[dev-db]", e?.message || e),
  });

  if (!alreadyInitialised) {
    await pg.initialise();
  }
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`[dev-db] created database "${database}"`);
  } catch {
    console.log(`[dev-db] database "${database}" already exists`);
  }

  const url = `postgresql://${user}:${password}@localhost:${port}/${database}?schema=public`;
  console.log(`[dev-db] PostgreSQL running on port ${port}`);
  console.log(`[dev-db] DATABASE_URL=${url}`);
  console.log("[dev-db] Press Ctrl+C to stop. Data is persisted in backend/pgdata.");

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    console.log("\n[dev-db] stopping...");
    try {
      await pg.stop();
    } catch (e) {
      console.error("[dev-db]", e?.message || e);
    }
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error("[dev-db] fatal:", e?.message || e);
  process.exit(1);
});
