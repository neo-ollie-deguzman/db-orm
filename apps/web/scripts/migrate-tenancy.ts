import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function migrateTenancy() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create new enums
    console.log("Creating enums...");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_plan') THEN
          CREATE TYPE "public"."tenant_plan" AS ENUM('free', 'pro', 'enterprise');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_type') THEN
          CREATE TYPE "public"."domain_type" AS ENUM('subdomain', 'custom');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_role') THEN
          CREATE TYPE "public"."tenant_role" AS ENUM('owner', 'admin', 'member');
        END IF;
      END $$;
    `);

    // 2. Create tenants table
    console.log("Creating tenants table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "region" text DEFAULT 'us-east-1' NOT NULL,
        "plan" "tenant_plan" DEFAULT 'free' NOT NULL,
        "settings" jsonb,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
      );
    `);

    // 3. Create tenant_domains table
    console.log("Creating tenant_domains table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenant_domains" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "domain" text NOT NULL,
        "type" "domain_type" NOT NULL,
        "is_verified" boolean DEFAULT false NOT NULL,
        "verification_token" text,
        "verified_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tenant_domains_domain_unique" UNIQUE("domain")
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_domains_tenant_id" ON "tenant_domains" USING btree ("tenant_id");
    `);

    // 4. Create tenant_memberships table
    console.log("Creating tenant_memberships table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenant_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" "tenant_role" DEFAULT 'member' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "uq_tenant_memberships_tenant_user" UNIQUE("tenant_id", "user_id")
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_memberships_tenant_id" ON "tenant_memberships" USING btree ("tenant_id");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_memberships_user_id" ON "tenant_memberships" USING btree ("user_id");
    `);

    // 5. Insert a default tenant so existing rows can be backfilled
    console.log("Creating default tenant...");
    const { rows } = await client.query(`
      INSERT INTO "tenants" ("name", "slug")
      VALUES ('Default Tenant', 'default')
      ON CONFLICT ("slug") DO UPDATE SET "name" = 'Default Tenant'
      RETURNING "id";
    `);
    const defaultTenantId = rows[0].id;
    console.log(`Default tenant ID: ${defaultTenantId}`);

    // 6. Add tenant_id as NULLABLE first to users and reminders
    console.log("Adding tenant_id columns...");
    const hasUsersTenantId = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'tenant_id';
    `);
    if (hasUsersTenantId.rows.length === 0) {
      await client.query(`ALTER TABLE "users" ADD COLUMN "tenant_id" uuid;`);
    }

    const hasRemindersTenantId = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'reminders' AND column_name = 'tenant_id';
    `);
    if (hasRemindersTenantId.rows.length === 0) {
      await client.query(
        `ALTER TABLE "reminders" ADD COLUMN "tenant_id" uuid;`,
      );
    }

    // 7. Backfill existing rows with the default tenant
    console.log("Backfilling tenant_id on existing rows...");
    const usersResult = await client.query(
      `UPDATE "users" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL`,
      [defaultTenantId],
    );
    console.log(`  users: ${usersResult.rowCount} rows updated`);

    const remindersResult = await client.query(
      `UPDATE "reminders" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL`,
      [defaultTenantId],
    );
    console.log(`  reminders: ${remindersResult.rowCount} rows updated`);

    // 8. Now set NOT NULL and add FK constraints
    console.log("Setting NOT NULL constraints and foreign keys...");
    await client.query(
      `ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;`,
    );
    await client.query(
      `ALTER TABLE "reminders" ALTER COLUMN "tenant_id" SET NOT NULL;`,
    );

    // Add FK if not already present
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'users_tenant_id_tenants_id_fk'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'reminders_tenant_id_tenants_id_fk'
        ) THEN
          ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_tenants_id_fk"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 9. Replace global email uniqueness with per-tenant uniqueness
    console.log("Updating unique constraints...");
    await client.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_tenant_email'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "uq_users_tenant_email" UNIQUE ("tenant_id", "email");
        END IF;
      END $$;
    `);

    // 10. Create indexes
    console.log("Creating indexes...");
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_tenant_id" ON "users" USING btree ("tenant_id");`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_reminders_tenant_id" ON "reminders" USING btree ("tenant_id");`,
    );
    await client.query(`DROP INDEX IF EXISTS "idx_reminders_user_active";`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_reminders_tenant_user_active"
      ON "reminders" USING btree ("tenant_id", "user_id", "is_deleted", "reminder_date");
    `);

    // 11. Enable RLS and create policies
    console.log("Enabling RLS and creating policies...");
    await client.query(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "users" FORCE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE "reminders" FORCE ROW LEVEL SECURITY;`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_users'
        ) THEN
          CREATE POLICY "tenant_isolation_users" ON "users"
            AS PERMISSIVE FOR ALL TO public
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_reminders'
        ) THEN
          CREATE POLICY "tenant_isolation_reminders" ON "reminders"
            AS PERMISSIVE FOR ALL TO public
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
        END IF;
      END $$;
    `);

    // 12. Create app_user role
    console.log("Creating app_user role...");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user NOLOGIN;
        END IF;
      END $$;
    `);
    await client.query(`GRANT USAGE ON SCHEMA public TO app_user;`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;`,
    );
    await client.query(`
      DO $$ BEGIN
        EXECUTE format('GRANT app_user TO %I', current_user);
      END $$;
    `);
    await client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    `);
    await client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO app_user;
    `);

    await client.query("COMMIT");
    console.log("\nMigration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateTenancy().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
