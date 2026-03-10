/**
 * Run only the BetterAuth schema migration (0002).
 * Use when the DB already has 0000 and 0001 applied and you want to apply 0002 without re-running all migrations.
 *
 * Usage: npx tsx --env-file=.env scripts/run-migrate-0002.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

neonConfig.webSocketConstructor = ws;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sqlPath = join(
    __dirname,
    "../../../packages/db/drizzle/0002_betterauth_schema.sql",
  );
  const sql = readFileSync(sqlPath, "utf-8");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const statements = sql
      .split(/--> statement-breakpoint\n?/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      console.log(`Running statement ${i + 1}/${statements.length}...`);
      await client.query(stmt);
    }

    await client.query("COMMIT");
    console.log("Migration 0002_betterauth_schema applied successfully.");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
