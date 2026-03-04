# db-orm

A multi-tenant SaaS proof-of-concept built with **Next.js 16**, **Drizzle ORM**, and **Neon Postgres**. The project demonstrates a contract-first API architecture with PostgreSQL Row-Level Security (RLS) for tenant isolation, JWT-based authentication, and a clean monorepo structure using pnpm workspaces.

## Architecture

```
db-orm-monorepo/
├── apps/
│   └── web/                  # Next.js 16 application (App Router, Turbopack)
├── packages/
│   ├── api-contracts/        # Zod schemas + OpenAPI generation (contract-first)
│   ├── auth/                 # JWT verification & API key validation
│   ├── core/                 # Business logic (framework-agnostic use cases)
│   └── db/                   # Drizzle schema, client, migrations, RLS tenant helper
├── scripts/                  # CI checks (contract usage enforcement)
└── docs/                     # Design documents and planning
```

### Package Dependency Graph

```
apps/web  →  @repo/core  →  @repo/db
          →  @repo/auth
          →  @repo/api-contracts
```

| Package               | Responsibility                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/db`            | Drizzle ORM schema definitions, Neon Postgres client, `withTenant()` RLS transaction helper, and migration files                                          |
| `@repo/core`          | Framework-agnostic business logic — use-case functions that accept `(tenantId, input)` and use `@repo/db` internally. No HTTP or framework types leak in. |
| `@repo/auth`          | JWT session verification (via `jose`) and API key validation stub. Provides `AuthContext` for route handlers.                                             |
| `@repo/api-contracts` | Zod schemas for all API request/response shapes, plus a script to generate an `openapi.json` spec from those schemas.                                     |
| `web`                 | Next.js application — API routes, React UI (Tailwind CSS v4), middleware for auth and tenant resolution.                                                  |

## Multi-Tenancy

Tenant isolation is enforced at **two layers**:

1. **Middleware-level resolution** — Every request passes through Next.js middleware that resolves a tenant from the hostname (subdomain or custom domain lookup) and injects `x-tenant-id`, `x-tenant-slug`, `x-tenant-name`, and `x-tenant-region` headers.

2. **PostgreSQL Row-Level Security** — The `users` and `reminders` tables have RLS policies that restrict all operations to rows matching `current_setting('app.current_tenant_id')::uuid`. The `withTenant()` helper wraps every query in a transaction that `SET LOCAL ROLE app_user` and sets the tenant context variable.

### Tenant Resolution Order

1. `X-Tenant-Slug` header override (development only)
2. Subdomain extraction — `{slug}.{APP_DOMAIN}` or `{slug}.localhost`
3. Custom domain lookup — `tenant_domains` table (verified domains only)

Results are cached in-memory with a 60-second TTL.

## Database Schema

Four core tables with full Drizzle relations defined:

| Table                | Key Columns                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tenants`            | `id` (uuid), `name`, `slug` (unique), `region`, `plan`, `is_active`                                                            |
| `tenant_domains`     | `id` (uuid), `tenant_id` (FK), `domain` (unique), `type` (subdomain/custom), `is_verified`                                     |
| `tenant_memberships` | `id` (uuid), `tenant_id` (FK), `user_id` (FK), `role` (owner/admin/member)                                                     |
| `users`              | `id` (serial), `tenant_id` (FK), `name`, `email`, `password_hash`, RLS-enforced                                                |
| `reminders`          | `id` (serial), `tenant_id` (FK), `user_id` (FK), `note`, `status` (pending/completed/dismissed), `reminder_date`, RLS-enforced |

Soft deletes are used for `users` and `reminders` (`is_deleted`, `deleted_at`).

## Authentication

- **Login** — `POST /api/auth/login` authenticates email + password (bcrypt) within the resolved tenant, issues an HS256 JWT stored as an `httpOnly` cookie (`session`).
- **Session** — JWT payload contains `tenantId`, `userId`, and `email`. Tokens expire after 24 hours.
- **Middleware** — Non-public routes require a valid session cookie. API routes get `401`; page routes are redirected to `/login`.
- **Logout** — `POST /api/auth/logout` clears the session cookie.

## API Endpoints

All endpoints require authentication (session cookie) except login.

| Method   | Path                 | Description                     |
| -------- | -------------------- | ------------------------------- |
| `POST`   | `/api/auth/login`    | Authenticate and create session |
| `POST`   | `/api/auth/logout`   | Destroy session                 |
| `GET`    | `/api/me`            | Current authenticated user      |
| `GET`    | `/api/users`         | List users in tenant            |
| `POST`   | `/api/users`         | Create a user                   |
| `GET`    | `/api/users/:id`     | Get user by ID                  |
| `PATCH`  | `/api/users/:id`     | Update a user                   |
| `DELETE` | `/api/users/:id`     | Soft-delete a user              |
| `GET`    | `/api/reminders`     | List reminders in tenant        |
| `POST`   | `/api/reminders`     | Create a reminder               |
| `GET`    | `/api/reminders/:id` | Get reminder by ID              |
| `PATCH`  | `/api/reminders/:id` | Update a reminder               |
| `DELETE` | `/api/reminders/:id` | Soft-delete a reminder          |

Request and response shapes are defined in `@repo/api-contracts` and enforced at both the API layer (Zod parsing) and response level (runtime schema validation).

### Contract-First Workflow

API route files **must** import schemas from `@repo/api-contracts`. This is enforced by `scripts/check-contract-usage.mjs` (intended for CI). An OpenAPI spec can be generated from the contracts:

```bash
pnpm generate:openapi
```

This writes `packages/api-contracts/openapi.json`.

## Prerequisites

- **Node.js** >= 20
- **pnpm** 9.15+
- **PostgreSQL** — [Neon](https://neon.tech) serverless Postgres (the driver uses WebSocket connections)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable       | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| `DATABASE_URL` | Neon Postgres connection string (`postgresql://...?sslmode=require`) |
| `JWT_SECRET`   | Secret for signing session JWTs (min 32 chars in production)         |

Optional:

| Variable     | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| `APP_DOMAIN` | Base domain for subdomain tenant resolution (e.g. `myapp.com`) |

### 3. Run database migrations

```bash
pnpm db:migrate
```

### 4. Apply RLS and create the `app_user` role

```bash
pnpm db:apply-rls
```

This runs `packages/db/drizzle/custom/0001_enable_rls.sql` which:

- Forces RLS on `users` and `reminders` tables
- Creates an `app_user` PostgreSQL role with scoped permissions
- Grants the connecting role permission to `SET ROLE app_user`

### 5. Run the multi-tenancy migration

```bash
pnpm db:migrate-tenancy
```

### 6. Seed the database

```bash
pnpm db:seed
```

This creates three tenants, 15 users across them, tenant memberships, and 70 sample reminders.

| Tenant          | Slug      | Users                               |
| --------------- | --------- | ----------------------------------- |
| Acme Corp       | `acme`    | 5 (Alice, Bob, Carol, David, Eva)   |
| Globex Inc      | `globex`  | 5 (Frank, Grace, Henry, Iris, Jack) |
| Initech Systems | `initech` | 5 (Liam, Mia, Noah, Olivia, Peter)  |

All seed accounts use the password: `passworD123`

### 7. Start the development server

```bash
pnpm dev
```

The app runs on `http://localhost:3000` with Turbopack.

### 8. Access a tenant

In local development, use subdomain-style hostnames or the `X-Tenant-Slug` header:

- Navigate to `http://acme.localhost:3000` (requires browser/OS that resolves `*.localhost`)
- Or use the `X-Tenant-Slug: acme` header when calling the API directly

## Available Scripts

All scripts are run from the monorepo root via `pnpm`:

| Script                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `pnpm dev`                | Start Next.js dev server with Turbopack              |
| `pnpm build`              | Production build                                     |
| `pnpm start`              | Start production server                              |
| `pnpm lint`               | Run Next.js linter                                   |
| `pnpm db:generate`        | Generate Drizzle migration files from schema changes |
| `pnpm db:migrate`         | Run pending migrations                               |
| `pnpm db:push`            | Push schema directly (skip migration files)          |
| `pnpm db:studio`          | Open Drizzle Studio (database GUI)                   |
| `pnpm db:seed`            | Seed database with sample data                       |
| `pnpm db:migrate-tenancy` | Run tenancy-specific migration                       |
| `pnpm db:migrate-auth`    | Run auth-specific migration                          |
| `pnpm db:apply-rls`       | Apply RLS policies and create `app_user` role        |
| `pnpm test:api`           | Run API integration tests                            |
| `pnpm generate:openapi`   | Generate OpenAPI spec from contracts                 |
| `pnpm check:contracts`    | Verify API routes import from `@repo/api-contracts`  |

## Tech Stack

| Layer           | Technology                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, React 19, Turbopack)                                  |
| Language        | TypeScript 5.7+                                                               |
| Database        | PostgreSQL (Neon serverless)                                                  |
| ORM             | Drizzle ORM 0.44                                                              |
| Styling         | Tailwind CSS v4                                                               |
| Auth            | JWT (jose), bcryptjs                                                          |
| Validation      | Zod                                                                           |
| API Spec        | OpenAPI 3.0 (generated from Zod schemas via `@asteasolutions/zod-to-openapi`) |
| Package Manager | pnpm 9.15 (workspaces)                                                        |
| Runtime         | Node.js >= 20                                                                 |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit conventions, and development workflow.

## Project Documentation

Detailed design documents are in the `docs/` directory:

- `api-architecture-plan.md` — API layer design and error handling strategy
- `multi-tenancy-plan.md` — Multi-tenancy architecture and RLS implementation
- `contract-first-workflow-plan.md` — Contract-first development approach
- `contract-first-agent-guide.md` — Guide for AI agents working with the contract-first pattern
- `code-repo-pr-process-plan.md` — Code review and PR process
- `code-repo-pr-process-research.md` — Research on PR workflows
- `ai-integration-development-context-research.md` — AI-assisted development context
