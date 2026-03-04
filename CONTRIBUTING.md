# Contributing

## Branch Naming

| Prefix      | Use case              | Example                              |
| ----------- | --------------------- | ------------------------------------ |
| `feature/`  | New feature           | `feature/add-reminder-filters`       |
| `fix/`      | Bug fix               | `fix/login-redirect-loop`            |
| `refactor/` | Code restructuring    | `refactor/extract-tenant-middleware` |
| `docs/`     | Documentation only    | `docs/update-api-readme`             |
| `chore/`    | Tooling, deps, config | `chore/upgrade-drizzle-orm`          |

Include a ticket reference when applicable: `feature/TICKET-123-short-description`.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow the format:

```
type(scope): description
```

- **type** (required): `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`, `build`, `revert`
- **scope** (optional): the area of the codebase — e.g. `api`, `db`, `auth`, `core`, `contracts`, `web`
- **description** (required): imperative, lowercase, no trailing period

### Examples

```
feat(api): add reminders list endpoint
fix(auth): handle expired JWT gracefully in middleware
refactor(core): extract shared validation into types module
docs: update README with multi-tenancy setup steps
chore: upgrade drizzle-orm to 0.44
test(api): add integration tests for user CRUD
ci: add typecheck job to GitHub Actions workflow
```

### Breaking Changes

Append `!` after the type/scope or add a `BREAKING CHANGE:` footer:

```
feat(db)!: rename tenant_id column to org_id

BREAKING CHANGE: all queries referencing tenant_id must be updated.
```

### Enforcement

Commit messages are validated by [commitlint](https://commitlint.js.org/) via a Husky `commit-msg` hook. Non-conforming messages will be rejected locally.

## Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) runs the following on every commit:

1. **lint-staged** — automatically formats staged files with Prettier and runs ESLint (with `--fix`) on `apps/web` source files.
2. **commitlint** — validates the commit message against the conventional commits spec.

If a hook fails, the commit is aborted. Fix the issues and try again.

## Code Style

- **Formatting**: [Prettier](https://prettier.io/) handles all formatting. Run `pnpm format` to format the entire repo, or `pnpm format:check` to verify without writing.
- **Linting**: ESLint is configured in `apps/web` (via Next.js). Run `pnpm lint` from the repo root.
- Do not disable lint rules without a comment explaining why.

## Development Workflow

1. Create a branch from `main` following the naming convention above.
2. Make changes and commit using conventional commit messages.
3. Push your branch and open a pull request targeting `main`.
4. Ensure all CI checks pass (lint, typecheck, test, build).
5. Request review — at least one human approval is required.
6. Merge via squash or rebase (per team preference).

## Scripts Reference

| Script                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `pnpm dev`              | Start Next.js dev server (Turbopack)        |
| `pnpm build`            | Production build                            |
| `pnpm lint`             | Run linter                                  |
| `pnpm format`           | Format all files with Prettier              |
| `pnpm format:check`     | Check formatting without writing            |
| `pnpm db:generate`      | Generate Drizzle migration files            |
| `pnpm db:migrate`       | Run pending migrations                      |
| `pnpm db:seed`          | Seed database with sample data              |
| `pnpm generate:openapi` | Generate OpenAPI spec from contracts        |
| `pnpm check:contracts`  | Verify API routes use `@repo/api-contracts` |
