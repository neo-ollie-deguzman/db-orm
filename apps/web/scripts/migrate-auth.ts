import { Pool, neonConfig } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DEFAULT_PASSWORD = "passworD123";

async function migrateAuth() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const col = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);

    if (col.rows.length === 0) {
      console.log("Adding password_hash column...");
      await client.query(`ALTER TABLE "users" ADD COLUMN "password_hash" text`);
    }

    console.log(`Hashing default password "${DEFAULT_PASSWORD}"...`);
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const result = await client.query(
      `UPDATE "users" SET "password_hash" = $1 WHERE "password_hash" IS NULL`,
      [hash],
    );
    console.log(
      `Backfilled ${result.rowCount} users with default password hash.`,
    );

    console.log("Setting NOT NULL constraint...");
    await client.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );

    await client.query("COMMIT");
    console.log("Auth migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAuth().catch((err) => {
  console.error("Auth migration failed:", err);
  process.exit(1);
});
