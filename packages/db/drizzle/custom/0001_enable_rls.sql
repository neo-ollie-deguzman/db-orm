-- Supplements the Drizzle migration which already runs:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--   CREATE POLICY tenant_isolation_* ...
--
-- This script adds FORCE (so even the table owner obeys RLS) and
-- creates the app_user role with scoped permissions.

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Allow the connecting role (e.g. neondb_owner) to SET ROLE app_user
-- so withTenant() can downgrade privileges inside transactions.
DO $$
BEGIN
  EXECUTE format('GRANT app_user TO %I', current_user);
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
