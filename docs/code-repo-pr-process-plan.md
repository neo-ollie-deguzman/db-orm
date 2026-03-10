# Code Repo & PR Process — Implementation Plan

Step-by-step implementation plan for the repo host, PR process, quality gates, and AI code review described in [code-repo-pr-process-research.md](./code-repo-pr-process-research.md). Use this document as a checklist; complete phases in order where dependencies exist.

---

## Overview

| Phase | Description                                          |
| ----- | ---------------------------------------------------- |
| **0** | Accounts and prerequisites                           |
| **1** | Repo creation and branch strategy                    |
| **2** | Local dev: conventional commits and pre-commit hooks |
| **3** | CI/CD: GitHub Actions workflow (quality gates)       |
| **4** | Branch protection and required status checks         |
| **5** | AI code review (CodeRabbit or alternative)           |
| **6** | Optional: deploy, Copilot, tuning                    |

**Assumptions:** GitHub as repo host (recommended in research); pnpm monorepo with `apps/*` and `packages/*`. For Bitbucket/GitLab, adapt steps using the research doc’s comparison tables.

---

## Phase 0: Accounts and prerequisites

### 0.1 Accounts to create or confirm

| Account / resource                 | Purpose                               | Link / notes                                                                  |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| **GitHub account**                 | Repo host, Actions, branch protection | [github.com](https://github.com) — use org account if team.                   |
| **GitHub organization** (optional) | Team repos, central billing, SSO      | Create org under GitHub → Your organizations.                                 |
| **CodeRabbit**                     | AI PR review (recommended for GitHub) | [coderabbit.ai](https://www.coderabbit.ai) — sign up; install via GitHub App. |
| **GitHub Copilot** (optional)      | PR summaries, inline suggestions      | Billing → Copilot; or org subscription.                                       |
| **Rovo Dev** (if Bitbucket/Jira)   | AI review with Jira AC validation     | Atlassian/Rovo subscription; connect Bitbucket or GitHub.                     |

### 0.2 Access and permissions

- **Repo:** Ensure you have **Admin** (or equivalent) on the repository to configure branch protection and install apps.
- **GitHub App install:** CodeRabbit (and similar tools) install per repo or per org; decide install scope before Phase 5.
- **Secrets:** For CI, you may later add secrets (e.g. `NODE_AUTH_TOKEN` for private packages, deploy keys); no secrets required for the base lint/typecheck/test/build workflow.

### 0.3 Local prerequisites

- **Git** — 2.x, configured with `user.name` and `user.email`.
- **Node.js** — v20+ (per repo `engines`).
- **pnpm** — 9.x (use `corepack enable` and repo `packageManager`).
- **Editor/IDE** — Cursor or VS Code recommended for AI-assisted commits and PR workflow.

### 0.4 Checklist — Phase 0

- [ ] GitHub account (and org if applicable) ready.
- [ ] CodeRabbit account created (or alternative chosen).
- [ ] Admin access to the repo confirmed.
- [ ] Git, Node, pnpm installed and working locally.

---

## Phase 1: Repo creation and branch strategy

### 1.1 Create or adopt the remote repo

1. On GitHub: **Create a new repository** (or use existing).
   - Name, e.g. `db-orm` or `your-org/db-orm`.
   - Visibility: Private (typical) or Public.
   - Do **not** initialize with README if you already have a local repo (you will push existing code).
2. Add remote (if local repo already exists):
   ```bash
   git remote add origin https://github.com/YOUR_ORG/db-orm.git
   # or: git remote add origin git@github.com:YOUR_ORG/db-orm.git
   ```

### 1.2 Initial branch layout

1. Ensure default branch is `main` (GitHub: Settings → General → Default branch).
2. Optionally create `develop` for integration:
   ```bash
   git checkout -b develop
   git push -u origin develop
   git checkout main
   ```
3. Document branch naming in the repo (e.g. in `CONTRIBUTING.md` or `docs/`):
   - `main` — production-ready; protected.
   - `develop` — integration (optional).
   - Feature: `feature/TICKET-123-short-description` or `feature/short-description`.
   - Fix: `fix/TICKET-456-description`.

### 1.3 First push (if repo was local-only)

```bash
git branch -M main
git push -u origin main
```

### 1.4 Checklist — Phase 1

- [ ] Remote repo exists and is accessible.
- [ ] Default branch is `main`.
- [ ] Optional `develop` created and pushed.
- [ ] Branch naming convention documented.

---

## Phase 2: Local dev — conventional commits and pre-commit hooks

### 2.1 Conventional commits

1. **Document convention** in the repo (e.g. `CONTRIBUTING.md` or `docs/development.md`):
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, etc.
   - Format: `type(scope): description` (scope optional).
   - Example: `feat(api): add reminders list endpoint`.
2. **Use Cursor's sparkle icon (✨)** in the Source Control panel to generate commit messages from staged changes. The icon appears next to the commit message input (`Ctrl+Shift+G` to open Source Control). You can also bind it to a shortcut via Keyboard Shortcuts → "Generate Commit Message".
3. **Add a Cursor rule** so the sparkle icon generates the right format. Create `.cursor/rules/commits.mdc`:

   ```markdown
   ---
   description: Commit message format for AI-generated commits
   globs: []
   alwaysApply: true
   ---

   Generate commit messages in Conventional Commits format:

   type(scope): short description

   Types: feat, fix, refactor, docs, test, chore, ci, perf, style
   Scope: package or area (api-contracts, core, db, auth, api, web). Omit scope only if change spans many packages.
   Description: lowercase, imperative mood, no period, max 72 chars.

   Examples:
   feat(api): add DELETE /api/reminders/:id endpoint
   fix(core): prevent duplicate email on createUser
   refactor(db): extract tenant helper into separate module
   docs: update PR process with CodeRabbit
   chore: upgrade drizzle-orm to 0.45
   ```

4. **commitlint** — enforce format via hook as the safety net (see 2.3). If the sparkle icon generates a bad format, commitlint rejects the commit.

### 2.2 Pre-commit hooks (Husky + lint/format)

1. **Install Husky and lint-staged** (root of monorepo):
   ```bash
   pnpm add -D -w husky lint-staged
   pnpm exec husky init
   ```
2. **Configure `package.json`** (root) — add:
   ```json
   "lint-staged": {
     "*.{js,ts,tsx,json,md}": [
       "prettier --write"
     ],
     "*.{js,ts,tsx}": [
       "eslint --fix"
     ]
     }
   ```
   Adjust globs and commands to match your repo (e.g. only `apps/web` and `packages/*` if ESLint is only there). If ESLint is only in `apps/web`, you may use:
   ```json
   "lint-staged": {
     "apps/web/**/*.{js,ts,tsx}": ["pnpm --filter web exec eslint --fix", "prettier --write"],
     "packages/**/*.{js,ts,tsx}": ["prettier --write"],
     "*.{json,md}": ["prettier --write"]
   }
   ```
3. **Pre-commit hook** — ensure `.husky/pre-commit` runs lint-staged:
   ```bash
   pnpm exec lint-staged
   ```
4. **commit-msg hook** — use commitlint to validate what the sparkle icon generates:
   ```bash
   pnpm add -D -w @commitlint/cli @commitlint/config-conventional
   echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js
   ```
   In `.husky/commit-msg`: `pnpm exec commitlint --edit $1`

### 2.3 Ensure lint and format exist

- **Lint:** Root `pnpm lint` currently runs `pnpm --filter web lint`. If you add ESLint to other packages, add a root script that runs lint across all (e.g. `pnpm -r run lint` or `pnpm --filter "./apps/*" --filter "./packages/*" run lint`).
- **Format:** Add Prettier at root if not present: `pnpm add -D -w prettier` and a script, e.g. `"format": "prettier --write ."` and `"format:check": "prettier --check ."`.

### 2.4 Checklist — Phase 2

- [ ] Conventional commit convention documented.
- [ ] `.cursor/rules/commits.mdc` created (sparkle icon generates correct format).
- [ ] Husky + lint-staged installed; pre-commit runs format and lint.
- [ ] Commitlint and commit-msg hook added (validates sparkle icon output).
- [ ] `pnpm lint` and format check work at root (or per package).

---

## Phase 3: CI/CD — GitHub Actions workflow (quality gates)

### 3.1 Add root scripts for CI (if missing)

In root `package.json`, ensure you have scripts CI can run in order (research: **lint → typecheck → test → build**):

| Script      | Purpose                       | Example (adapt to your repo)                                                                               |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `lint`      | Lint all relevant code        | Already: `pnpm --filter web lint`. Consider `pnpm -r run lint` when multiple packages have lint.           |
| `typecheck` | TypeScript check without emit | Add e.g. `pnpm -r exec tsc --noEmit` or run in each package that has `tsconfig.json`.                      |
| `test`      | Run tests                     | Add e.g. `pnpm -r run test` or `pnpm run test:api` plus any unit tests; use `test` as the name CI expects. |
| `build`     | Build monorepo                | Already: `pnpm --filter web build`. Ensure dependencies build first (e.g. build packages then app).        |

Example addition for typecheck (if packages use TypeScript):

```json
"typecheck": "pnpm -r exec tsc --noEmit",
"test": "pnpm run test:api"
```

If you have no unit tests yet, you can run only `test:api` or a placeholder; add real tests later and keep the same script name for CI.

### 3.2 Create the workflow file

1. Create directory: `.github/workflows/`.
2. Create file: `.github/workflows/ci.yml` (or `pr-checks.yml`).

### 3.3 Workflow content (GitHub Actions)

Use the following as the main CI workflow. It runs on push to feature branches and on pull requests targeting `main` (and optionally `develop`), with jobs: **lint → typecheck → test → build** (fail fast).

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm run lint

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm run typecheck
        continue-on-error: true # remove when typecheck script exists and passes

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm run test
        continue-on-error: true # remove when test script runs and passes

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm run build
```

**Notes:**

- Remove `continue-on-error: true` from `typecheck` and `test` once those scripts exist and pass.
- If you prefer strict ordering without parallel lint/typecheck/test, set `needs: [lint]` on typecheck, `needs: [typecheck]` on test, and `needs: [test]` on build; the above runs lint, typecheck, and test in parallel, then build after all three (fail fast at merge time via branch protection).

### 3.4 Optional: security audit step

Add a job (or step) for `pnpm audit` and optionally block merge on high/critical (e.g. with `audit-ci` or a separate “Security” job that fails on high/critical).

### 3.5 Checklist — Phase 3

- [ ] Root `package.json` has `lint`, `typecheck` (or equivalent), `test`, `build` scripts.
- [ ] `.github/workflows/ci.yml` created with the four jobs.
- [ ] Workflow runs on push and pull_request to `main` (and `develop` if used).
- [ ] `continue-on-error` removed once typecheck/test are implemented and green.
- [ ] Optional: audit/security step added.

---

## Phase 4: Branch protection and required status checks

### 4.1 Open branch protection

1. GitHub repo → **Settings** → **Branches** → **Add branch protection rule** (or edit existing).
2. **Branch name pattern:** `main` (and optionally `develop`).

### 4.2 Configure rules

Apply at least:

| Setting                                              | Value                                | Reason                                                                      |
| ---------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| **Require a pull request before merging**            | On                                   | Enforce PR flow.                                                            |
| **Require approvals**                                | 1 (or 2)                             | Human review mandatory.                                                     |
| **Require status checks to pass before merging**     | On                                   | Quality gates.                                                              |
| **Require branches to be up to date before merging** | Optional (can slow merges)           | Prefer optional unless you want strict linear history.                      |
| **Status checks that are required**                  | `Lint`, `Typecheck`, `Test`, `Build` | Must match job names in `.github/workflows/ci.yml`.                         |
| **Do not allow bypassing the above settings**        | On (if available)                    | Prevents admins from merging without checks.                                |
| **Restrict who can push to matching branches**       | Optional                             | Leave empty or add a group that can push to `main` (e.g. release managers). |
| **Allow force pushes**                               | Disabled                             | Prefer disabled for `main`/`develop`.                                       |
| **Allow deletions**                                  | Disabled                             | Prevent accidental branch deletion.                                         |

### 4.3 Status check names

The names in “Require status checks to pass” must match the **job names** in your workflow. In the example workflow they are: `Lint`, `Typecheck`, `Test`, `Build`. After the first successful workflow run, these appear in the dropdown; select them.

### 4.4 Checklist — Phase 4

- [ ] Branch protection rule added for `main` (and `develop` if used).
- [ ] “Require a pull request” and “Require approvals” (≥ 1) enabled.
- [ ] “Require status checks” enabled; `Lint`, `Typecheck`, `Test`, `Build` required.
- [ ] Force pushes and branch deletion disabled for protected branches.

---

## Phase 5: AI code review (CodeRabbit or alternative)

### 5.1 Choose the tool

**Decision: CodeRabbit** for GitHub (confirmed). The steps below cover installation and configuration.

### 5.2 Install CodeRabbit (GitHub)

1. Sign in at [coderabbit.ai](https://www.coderabbit.ai) with your GitHub account.
2. **Install the GitHub App:** Choose “Install” and select the organization or repository (e.g. only `db-orm` or all repos in the org).
3. Grant the requested permissions (read/write on PRs and metadata).
4. After install, CodeRabbit will start reviewing new pull requests automatically.

### 5.3 Optional: configure CodeRabbit

1. In CodeRabbit dashboard, select the repo.
2. Add a **configuration file** in the repo (e.g. `.coderabbit.yaml` or in `.github/coderabbit.yaml`) to:
   - Reduce noise (e.g. ignore certain paths, severity thresholds).
   - Add custom instructions or focus areas.
3. Tune over time based on team feedback (mark comments helpful/not helpful if the product supports it).

### 5.4 Human review remains required

Branch protection already requires at least one human approval (Phase 4). Do **not** allow merging on AI review alone; keep “Require approvals” ≥ 1 so a human must approve every PR.

### 5.5 Checklist — Phase 5

- [ ] CodeRabbit (or chosen alternative) account and GitHub App install completed.
- [ ] First PR opened and CodeRabbit comment/review appeared.
- [ ] Optional: `.coderabbit.yaml` (or equivalent) added and tuned.
- [ ] Human approval still required in branch protection.

---

## Phase 6: Optional enhancements

### 6.1 GitHub Copilot (PR summaries)

- Enable Copilot for the org or repo (billing/subscription).
- In PR description or comments, use the “Summary” action so Copilot generates a PR summary.
- Document for the team: use `@copilot` in comments for explicit agent actions (if using coding agent).

### 6.2 Deploy on merge to main

- Add a second workflow, e.g. `.github/workflows/deploy.yml`, that triggers on `push` to `main`.
- Steps: checkout, pnpm install, build, then deploy to your staging (or production) environment (e.g. Vercel, AWS, or your own runner).
- Do **not** require this job as a status check for PRs if it’s slow or environment-specific; use it only for post-merge deployment.

### 6.3 PR template

- Create `.github/pull_request_template.md` with sections such as: Description, Ticket link, Checklist (e.g. tests added, docs updated). This helps authors and AI-generated descriptions stay consistent.

### 6.4 Issue / ticket integration

- If using Jira/Linear/GitHub Issues, document how to reference tickets in branch names and PR titles (e.g. `TICKET-123`) so CodeRabbit or Rovo can use context when available.

### 6.5 Checklist — Phase 6

- [ ] Optional: Copilot enabled and PR summary usage documented.
- [ ] Optional: Deploy workflow added and tested.
- [ ] Optional: PR template and ticket reference convention documented.

---

## Verification checklist (end-to-end)

Run through once to confirm the full flow:

1. **Branch:** Create `feature/test-pr-process` from `main`, make a small change (e.g. edit README or add a comment).
2. **Commit:** Stage the change, click the sparkle icon (✨) to generate the message (e.g. `docs: add PR process verification`), commit. Commitlint validates; lint-staged formats.
3. **Push:** Push the branch; CI workflow runs (Lint, Typecheck, Test, Build).
4. **PR:** Ask Cursor Agent "create a PR for this branch" (generates title + body from diff), or run `gh pr create` manually.
5. **AI review:** CodeRabbit auto-reviews (summary, inline comments, one-click fixes).
6. **Human review:** A teammate (or second account) approves the PR.
7. **Merge:** Ensure all status checks are green and one approval is present; merge (squash or rebase per your policy).
8. **Post-merge:** If deploy workflow is configured, confirm it runs on `main`.

---

## Real-world example: soft-delete reminders endpoint

A concrete walkthrough of the full PR process using this codebase (adding `DELETE /api/reminders/:id` with soft-delete).

### 1. Branch

```bash
git checkout main && git pull
git checkout -b feature/PROJ-42-soft-delete-reminder
```

### 2. Commits

Implement across three packages. For each commit: stage files → click sparkle icon (✨) → Cursor generates the message using `.cursor/rules/commits.mdc` → commitlint validates → lint-staged runs prettier.

```bash
# Stage packages/api-contracts/src/schemas/reminders.ts → click ✨ → generates:
git commit -m "feat(api-contracts): add delete reminder response schema"

# Stage packages/core/src/reminders.ts → click ✨ → generates:
git commit -m "feat(core): implement soft-delete for reminders"

# Stage apps/web/src/app/api/reminders/[id]/route.ts → click ✨ → generates:
git commit -m "feat(api): add DELETE /api/reminders/:id endpoint"
```

### 3. Push & PR

```bash
git push -u origin feature/PROJ-42-soft-delete-reminder
```

Push triggers CI (lint → typecheck → test → build). Create the PR using Cursor Agent or manually:

**Option A — Cursor Agent** (generates title + body from diff):
Ask the agent: "create a PR for this branch targeting main". Cursor reads the commits and diff, generates a conventional title and summary, and runs `gh pr create`.

**Option B — manual `gh` CLI:**

```bash
gh pr create \
  --title "feat: soft-delete reminders via DELETE /api/reminders/:id" \
  --body "## Summary
- Adds DeleteReminderResponseSchema to @repo/api-contracts
- Updates deleteReminder() in @repo/core to set isDeleted=true instead of hard delete
- Adds DELETE handler in apps/web/src/app/api/reminders/[id]/route.ts using withAuth()

Closes PROJ-42"
```

**Option C — `gh` CLI one-liner** (auto-generates from commit log):

```bash
gh pr create \
  --title "$(git log main..HEAD --format='%s' | head -1)" \
  --body "$(git log main..HEAD --format='- %s')"
```

After the PR is opened, **CodeRabbit** automatically adds a detailed walkthrough comment (file-by-file summary, severity-ranked findings, one-click fixes).

### 4. Review

- **CodeRabbit** auto-reviews within minutes: posts a PR summary/walkthrough, inline comments ranked by severity (e.g. flags missing `pnpm generate:openapi` after adding a schema, suggests adding a test for the soft-delete path), and offers one-click fixes for style issues.
- **CI** must be green: Lint, Typecheck, Test, Build all pass.
- **Human reviewer** reads CodeRabbit's summary, checks the diff focusing on domain logic (is soft-delete correct? does RLS still apply?), and approves.

### 5. Merge

All gates met (CI green + CodeRabbit reviewed + 1 human approval). Squash merge:

```bash
gh pr merge --squash
```

Result on `main`: single commit `feat: soft-delete reminders via DELETE /api/reminders/:id (#18)`.

### 6. Gates (pre-configured, not per-PR)

These are enforced by branch protection on `main`:

- Required status checks: `Lint`, `Typecheck`, `Test`, `Build` must pass.
- Required reviews: at least 1 human approval.
- No force-push to `main`.
- No merge with failing checks.

---

## Reference

- **Research and rationale:** [code-repo-pr-process-research.md](./code-repo-pr-process-research.md)
- **Branch naming and PR process:** Document in `CONTRIBUTING.md` or `docs/development.md` and link from the repo root.
