import { Pool, neonConfig } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function applyRls() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  // RLS SQL lives in @repo/db (packages/db/drizzle)
  const dbPkgDir = path.join(
    path.dirname(require.resolve("@repo/db/package.json")),
    "drizzle",
  );
  const sqlFile = path.join(dbPkgDir, "custom", "0001_enable_rls.sql");
  const sqlContent = fs.readFileSync(sqlFile, "utf-8");

  console.log("Applying RLS migration...");
  await pool.query(sqlContent);
  console.log("RLS migration applied successfully.");

  await pool.end();
}

applyRls().catch((err) => {
  console.error("RLS migration failed:", err);
  process.exit(1);
});
