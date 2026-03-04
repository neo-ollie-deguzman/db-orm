---
name: Contract-First Workflow Plan
overview: AI-ready contract-first API workflow for the coupled Next.js API: define the API in Zod (single source of truth), generate OpenAPI from it, implement handlers with agent assistance, and enforce correctness via TypeScript and runtime validation.
todos:
  - id: cf-phase1-contracts-package
    content: "Phase 1: Create packages/api-contracts with Zod schemas (users, reminders). Export schemas and z.infer types. No OpenAPI generation yet."
    status: pending
  - id: cf-phase2-openapi-gen
    content: "Phase 2: Add OpenAPI generation (e.g. @asteasolutions/zod-to-openapi). Script that writes openapi.json from registered schemas and paths. Run in build/CI."
    status: pending
  - id: cf-phase3-wire-web
    content: "Phase 3: Wire Next.js API routes to api-contracts. Replace app-level validations with imports from @repo/api-contracts. Handlers parse with contract schemas."
    status: pending
  - id: cf-phase4-agent-prompt
    content: "Phase 4: Document agentic workflow—prompt template, openapi.json location, and handler pattern for AI-assisted implementation."
    status: completed
  - id: cf-phase5-validation
    content: "Phase 5: Enforce single source (lint or CI check that route handlers use @repo/api-contracts for contracted endpoints). Optional: response schema validation."
    status: completed
isProject: false
---

# Contract-First Workflow: AI-Ready API Design

This plan describes an **AI-ready contract-first** workflow for the API: define the contract in Zod once, generate OpenAPI from it, implement handlers (with or without AI assistance), and rely on TypeScript and runtime validation as guardrails. It extends [API Architecture Plan](./api-architecture-plan.md) Phase 5 (packages/api-contracts) with a concrete four-step workflow and implementation phases.

---

## The Four-Step Workflow

| Step  | Name                                   | Description                                                                                                                                                                                                                                                           |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Define the Spec (The "What")**       | You or an AI architect define the API contract in a schema file using Zod. Zod is the single source of truth and is effectively a "live" version of OpenAPI.                                                                                                          |
| **2** | **Generate the Spec**                  | A tool compiles your Zod schemas into a standard `openapi.json`. The spec is derived from the contract, not hand-written, so it stays in sync.                                                                                                                        |
| **3** | **Agentic Implementation (The "How")** | You provide an AI agent (e.g. Cursor or Claude Code) with the `openapi.json` and a prompt such as: "Implement the handler for POST /users based on this spec." The agent writes the handler; the handler uses the same Zod from the contract package.                 |
| **4** | **Automated Validation**               | Because the handler uses the same Zod schema that generated the spec, the TypeScript compiler and runtime `.parse()` act as guardrails. If the AI (or a human) hallucinates a field or changes the shape, the code won't compile or the request will fail validation. |

---

## Relationship to Existing Architecture

- **packages/core** remains the single source of truth for **business logic** (createUser, listReminders, etc.).
- **packages/api-contracts** becomes the single source of truth for the **HTTP contract** (request/response shapes, status codes). Handlers in **apps/web** import from api-contracts, parse input with Zod, call core, and return responses that match the contract types.
- **Core** does not depend on api-contracts; it already accepts typed input. The contract package defines that type in one place and feeds both the OpenAPI spec and the route handlers.

---

## Step 1: Define the Spec (The "What")

### Responsibility

- Define all API request bodies, query parameters, and response shapes in **Zod** inside **packages/api-contracts**.
- One schema per logical resource or endpoint (e.g. `CreateUserBodySchema`, `UserResponseSchema`, `UsersListResponseSchema`). Reuse smaller schemas where possible.
- Export both the Zod schemas and inferred TypeScript types (`z.infer<typeof Schema>`).
- Optionally attach OpenAPI metadata (e.g. descriptions, examples) using `@asteasolutions/zod-to-openapi` so the generated spec is richer.

### File layout (target)

```
packages/api-contracts/
  package.json          # dependency: zod (and optionally @asteasolutions/zod-to-openapi)
  tsconfig.json
  src/
    schemas/
      users.ts          # CreateUserBodySchema, UpdateUserBodySchema, UserResponseSchema, UsersListResponseSchema
      reminders.ts      # CreateReminderBodySchema, ReminderResponseSchema, ListRemindersQuerySchema, etc.
    index.ts            # re-export all schemas and types
```

### Contract rules

- No framework imports (no Next.js). Pure Zod (and OpenAPI helpers if used).
- Schemas are the single source of truth for the HTTP layer; handlers and OpenAPI both derive from them.

---

## Step 2: Generate the Spec (openapi.json)

### Responsibility

- Produce a standard **OpenAPI 3** document (`openapi.json` or `openapi.yaml`) from the Zod schemas.
- Run as a **build-time or CI step** so the spec is always up to date.

### Recommended approach: @asteasolutions/zod-to-openapi

- **zod-to-openapi** is contract-first: you define a **registry**, register your Zod schemas and **paths** (method, path, request/response schemas). The library outputs a full OpenAPI 3 spec.
- Alternative: **zod-to-json-schema** plus a thin wrapper to build `components.schemas` and paths; more manual but no extra API.
- **next-openapi-gen** is code-first (scans Next.js route files). Use it only if you want route-level doc generation later; for "define schema first, then generate spec," Zod as source + zod-to-openapi is the right fit.

### Implementation

- Add a script (e.g. `packages/api-contracts/scripts/generate-openapi.ts` or root `scripts/generate-openapi.ts`) that:
  1. Imports the contract schemas and (if using zod-to-openapi) registers them and the paths.
  2. Calls the generator and writes `openapi.json` to a fixed location (e.g. `packages/api-contracts/openapi.json` or `docs/openapi.json`).
- Add an npm script (e.g. `pnpm generate:openapi` or `pnpm --filter api-contracts generate:openapi`) and run it in CI or before releases so the checked-in or published spec is current.

### Output

- A single **openapi.json** (or **openapi.yaml**) that describes all contracted endpoints. This file is what you give to the AI agent and to external consumers for documentation or codegen.

---

## Step 3: Agentic Implementation (The "How")

### Responsibility

- Implement route handlers (Next.js API routes) that satisfy the contract. Implementation can be done by a human or by an AI agent given the spec and a clear prompt.

### Artifacts for the agent

1. **openapi.json** — The generated spec (path, e.g. `docs/openapi.json` or `packages/api-contracts/openapi.json`).
2. **Prompt template** — Instructions such as:
   - "Implement the handler for POST /users according to `docs/openapi.json`. Use the Zod schemas from `@repo/api-contracts` for request validation and response typing. Resolve tenant (e.g. from session/middleware), then call `createUser(tenantId, body)` from `@repo/core`. Return the created user using the response schema and status 201. On validation failure return 400 with a structured error."

### Handler pattern (what the agent should produce)

- **Import** request/response schemas from `@repo/api-contracts`.
- **Parse** body/query with the contract schema: e.g. `CreateUserBodySchema.parse(await request.json())` or `.safeParse()` and return 400 on failure.
- **Resolve** tenant and auth (middleware or inside handler).
- **Call** core: e.g. `createUser(tenantId, parsed)`.
- **Return** a response that matches the contract (typed with `z.infer<typeof UserResponseSchema>` or the same schema used for runtime validation).

### Where handlers live

- **Next.js**: `apps/web/src/app/api/**/route.ts` (and Server Actions if they expose the same contract).

---

## Step 4: Automated Validation (Guardrails)

### Responsibility

- Ensure handlers cannot drift from the contract without failing type-check or runtime validation.

### Compile-time (TypeScript)

- Handlers use types derived from the contract: e.g. `z.infer<typeof CreateUserBodySchema>` for input and `z.infer<typeof UserResponseSchema>` for output. If the agent or a developer invents a field or wrong type, `tsc` fails.

### Runtime

- **Request**: `CreateUserBodySchema.parse(body)` or `.safeParse()`; invalid payloads are rejected before calling core.
- **Response** (optional): Validate the object returned from core against the response schema before `NextResponse.json(...)` to catch mistakes.

### Process / CI

- **Single source**: Contracted endpoints must import from `@repo/api-contracts` only (no duplicate Zod in `apps/web/src/lib/validations` for those endpoints). Enforce via a lint rule or a small CI script that greps for contract usage in route files.
- **Build**: Run `pnpm generate:openapi` in CI so the spec is regenerated and can be diffed or published.
- **Tests**: Optional; add integration tests that hit the route with valid/invalid payloads and assert status codes and response shape against the contract.

---

## Implementation Phases (Summary)

| Phase | Task                                                                                           | Outcome                                                   |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **1** | Create packages/api-contracts with Zod schemas (users, reminders). Export schemas and types.   | Single place for HTTP contract; no OpenAPI file yet.      |
| **2** | Add OpenAPI generation (e.g. zod-to-openapi). Script + npm script; run in build/CI.            | openapi.json generated from Zod.                          |
| **3** | Wire Next.js API routes to api-contracts. Replace app-level validations with contract imports. | Handlers use contract schemas; types and runtime aligned. |
| **4** | Document agentic workflow: prompt template, openapi.json location, handler pattern.            | Clear instructions for AI-assisted implementation.        |
| **5** | Enforce single source (lint/CI); optional response validation.                                 | No duplicate schemas; stronger guardrails.                |

---

## Tooling Summary

| Need                    | Choice                              | Notes                                                                                         |
| ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| **Contract definition** | Zod in packages/api-contracts       | Single source; framework-agnostic.                                                            |
| **Zod → OpenAPI**       | @asteasolutions/zod-to-openapi      | Registry + paths → full OpenAPI 3. For Zod v3 use 7.x; for Zod v4 use 8.x.                    |
| **Alternative**         | zod-to-json-schema + custom script  | Lighter; you assemble paths and components manually.                                          |
| **Code-first doc tool** | next-openapi-gen                    | Use only if you want to scan Next routes for docs; not the primary source for contract-first. |
| **Runtime validation**  | schema.parse() / schema.safeParse() | In handlers; same schema as spec.                                                             |

---

## Open Questions / TBD

- **Versioning**: Whether openapi.json is versioned (e.g. /v1 in paths) and how that maps to packages/api-contracts (e.g. schemas/v1/).
- **Response validation**: Whether to always validate response bodies with the contract schema before sending (extra safety vs. performance).
- **Server Actions**: Whether Server Actions that mirror API routes should use the same contract types and, if so, how (e.g. shared types only or full Zod parse).

---

## References

- [Contract-First Agent Guide](./contract-first-agent-guide.md) — Prompt template, openapi.json location, handler pattern, CI check, optional response validation.
- [API Architecture Plan](./api-architecture-plan.md) — Phase 4 (packages/api-contracts).
- [@asteasolutions/zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi) — Zod to OpenAPI 3 generation.
- Existing validations: `apps/web/src/lib/validations/users.ts`, `apps/web/src/lib/validations/reminders.ts` (serializers only; schemas come from api-contracts for contracted endpoints).
