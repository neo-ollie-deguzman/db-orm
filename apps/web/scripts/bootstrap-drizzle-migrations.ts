/**
 * Mark migrations 0000–0002 as already applied in Drizzle's journal table.
 * Use when the DB was set up via run-migrate-0002.ts or manual SQL, so
 * drizzle.__drizzle_migrations is empty and "pnpm db:migrate" would re-run 0000
 * and fail (e.g. "type reminder_status already exists").
 *
 * Run once, then: pnpm db:migrate (will apply only 0003 and any later migrations).
 *
 * Usage: npx tsx --env-file=.env scripts/bootstrap-drizzle-migrations.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

neonConfig.webSocketConstructor = ws;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const drizzleDir = join(process.cwd(), "../../packages/db/drizzle");

  // Insert 0000, 0001, 0002 so Drizzle considers them applied (only runs 0003+).
  const entries = [
    { tag: "0000_medical_nighthawk", when: 1772033640519 },
    { tag: "0001_add_tenancy", when: 1772047367407 },
    { tag: "0002_betterauth_schema", when: 1772100000000 },
  ];

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows } = await client.query(
      "SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1",
    );
    if (rows.length > 0) {
      console.log("Migrations table already has entries; nothing to do.");
      return;
    }

    for (const entry of entries) {
      const sql = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf-8");
      const hash = createHash("sha256").update(sql).digest("hex");
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when],
      );
    }

    console.log(
      "Marked 0000, 0001, 0002 as applied. Run pnpm db:migrate to apply 0003 and later.",
    );
  } catch (err) {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
