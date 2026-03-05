-- BetterAuth schema: users.id -> text (UUID), add email_verified/two_factor_enabled,
-- new tables (sessions, accounts, verifications, two_factors), user_id text in reminders/memberships.
-- WARNING: Drops and recreates users, tenant_memberships, reminders. Run only on dev or when data can be reset.
--
-- Note: users.avatar_url is the DB column name; the Drizzle schema maps it as "image" for BetterAuth compatibility.

DROP POLICY IF EXISTS "tenant_isolation_reminders" ON "reminders";
DROP POLICY IF EXISTS "tenant_isolation_users" ON "users";
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_tenant_id_tenants_id_fk";
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_user_id_users_id_fk";
ALTER TABLE "tenant_memberships" DROP CONSTRAINT IF EXISTS "tenant_memberships_user_id_users_id_fk";
ALTER TABLE "tenant_memberships" DROP CONSTRAINT IF EXISTS "tenant_memberships_tenant_id_tenants_id_fk";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_tenants_id_fk";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "uq_users_tenant_email";
DROP INDEX IF EXISTS "idx_reminders_tenant_user_active";
DROP INDEX IF EXISTS "idx_reminders_tenant_id";
DROP INDEX IF EXISTS "idx_reminders_user_id";
DROP INDEX IF EXISTS "idx_users_tenant_id";
DROP INDEX IF EXISTS "idx_tenant_memberships_user_id";
DROP INDEX IF EXISTS "idx_tenant_memberships_tenant_id";

DROP TABLE IF EXISTS "reminders";
DROP TABLE IF EXISTS "tenant_memberships";
DROP TABLE IF EXISTS "users";

CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "avatar_url" text,
  "location" text,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "two_factor_enabled" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "uq_users_tenant_email" UNIQUE("tenant_id","email")
);

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_users_tenant_id" ON "users" USING btree ("tenant_id");
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_users" ON "users" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.current_tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");

CREATE TABLE "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "id_token" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");

CREATE TABLE "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "two_factors" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_two_factors_user_id" ON "two_factors" USING btree ("user_id");

CREATE TABLE "tenant_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "role" "tenant_role" DEFAULT 'member' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_tenant_memberships_tenant_user" UNIQUE("tenant_id","user_id")
);

ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_tenant_memberships_tenant_id" ON "tenant_memberships" USING btree ("tenant_id");
CREATE INDEX "idx_tenant_memberships_user_id" ON "tenant_memberships" USING btree ("user_id");

CREATE TABLE "reminders" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "note" text NOT NULL,
  "status" "reminder_status" DEFAULT 'pending' NOT NULL,
  "reminder_date" timestamp NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_reminders_user_id" ON "reminders" USING btree ("user_id");
CREATE INDEX "idx_reminders_reminder_date" ON "reminders" USING btree ("reminder_date");
CREATE INDEX "idx_reminders_tenant_id" ON "reminders" USING btree ("tenant_id");
CREATE INDEX "idx_reminders_tenant_user_active" ON "reminders" USING btree ("tenant_id","user_id","is_deleted","reminder_date");
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_reminders" ON "reminders" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.current_tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
