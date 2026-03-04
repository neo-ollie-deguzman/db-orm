import { defineConfig } from "drizzle-kit";

// Schema and migrations live in @repo/db; run drizzle-kit from web so .env is loaded.
export default defineConfig({
  schema: "../../packages/db/src/schema.ts",
  out: "../../packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  entities: {
    roles: {
      provider: "neon",
    },
  },
});
