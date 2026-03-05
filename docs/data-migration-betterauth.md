# Data Migration: BetterAuth & UUID User IDs

This document describes the migration from the previous JWT/serial user ID setup to **BetterAuth** with **UUID user IDs**.

## Summary of schema changes

- **users.id**: `serial` (integer) → `text` (UUID)
- **users**: removed `password_hash`; added `email_verified`, `two_factor_enabled`; `avatar_url` column kept, mapped as `image` in app
- **tenant_memberships.user_id**, **reminders.user_id**: integer → text (UUID)
- **New tables**: `sessions`, `accounts`, `verifications`, `two_factors` (BetterAuth)

## Fresh install

1. Run migrations: `pnpm db:migrate` (or `pnpm db:push` if using push-based workflow).
2. Apply RLS: `pnpm db:apply-rls`.
3. Run tenancy migration if needed: `pnpm db:migrate-tenancy`.
4. Seed: `pnpm db:seed`.

The seed script creates users with UUIDs and inserts rows into `accounts` (credential provider) so sign-in with email/password works. Default password for seed users: `passworD123`.

## Migrating existing data (pre–BetterAuth)

If you have existing data with integer user IDs and `password_hash` on `users`:

1. Generate and run a Drizzle migration that:
   - Adds new columns/tables (e.g. `sessions`, `accounts`, `verifications`, `two_factors`, `email_verified`, `two_factor_enabled`).
   - Adds a new `id` column (text/UUID) to `users`, backfills UUIDs, migrates FKs, then switches primary key (or follow your DB’s recommended path for changing PK type).
2. Migrate passwords into `accounts`: for each user, insert an `accounts` row with `provider_id = 'credential'`, `user_id = user.id` (new UUID), and `password` = existing hashed password (bcrypt is supported by BetterAuth for verification).
3. Remove `password_hash` from `users` and drop the old integer `id` column once FKs are updated.
4. Re-enable RLS and run `pnpm db:apply-rls` if needed.

For a development or POC database, the simplest path is often: backup, drop and recreate schema, run migrations, then `pnpm db:seed`.
