# Contract-First Agent Guide: AI-Assisted API Implementation

This guide is for **AI agents** (e.g. Cursor, Claude Code) and **developers** implementing or changing API route handlers in this repo. It describes where the spec lives, how to use it, and the handler pattern to follow so implementations stay aligned with the contract.

See [Contract-First Workflow Plan](./contract-first-workflow-plan.md) for the full workflow and architecture.

---

## 1. OpenAPI spec location

| Artifact             | Path                                                     |
| -------------------- | -------------------------------------------------------- |
| **OpenAPI 3 spec**   | `packages/api-contracts/openapi.json`                    |
| **Contract package** | `packages/api-contracts` (Zod schemas + `z.infer` types) |

The spec is **generated** from the Zod schemas in `packages/api-contracts`. Regenerate it with:

```bash
pnpm generate:openapi
```

Use `packages/api-contracts/openapi.json` when implementing or reviewing handlers. Do not hand-edit it; change the Zod schemas and regenerate.

---

## 2. Prompt template for implementing a handler

When asking an AI (or guiding a human) to implement or update a route, use a prompt like the following. Replace placeholders with the actual method, path, and core function.

**Implement the handler for `{METHOD} {PATH}` according to `packages/api-contracts/openapi.json`.**

- **Request**: Use the Zod schemas from `@repo/api-contracts` for request validation. Parse the body (or query) with the appropriate schema (e.g. `CreateUserBodySchema`, `UpdateUserBodySchema`) using `.safeParse()`. On validation failure, return **400** with a structured error (use the app’s `validationError` helper from `@/lib/errors`).
- **Auth & tenant**: Resolve the current user (e.g. `getCurrentUser()` from `@/lib/auth`) and tenant (e.g. `getTenantId()` from `@/lib/tenant`). Return **401** if unauthenticated.
- **Core**: Call the corresponding function from `@repo/core` with `(tenantId, ...)` (e.g. `createUser(tenantId, body, passwordHash)`, `listUsers(tenantId)`, `updateUser(tenantId, id, body)`). Handle core errors (e.g. `CoreNotFoundError` → 404, `CoreConflictError` → 409) via the app’s error helpers.
- **Response**: Return a response that matches the contract: use the **response types** from `@repo/api-contracts` (e.g. `UserResponse`, `UsersListResponse`, `ReminderResponse`) and the correct status code (e.g. 200, 201, 204). Serialize domain objects to the API shape using the app’s serializers (e.g. `serializeUser`, `serializeReminder` from `@/lib/validations/users` and `@/lib/validations/reminders`).

**Example (POST /api/users):**

> Implement the handler for **POST /api/users** according to `packages/api-contracts/openapi.json`. Use `CreateUserBodySchema` from `@repo/api-contracts` for request validation and `UserResponse` for the response type. Resolve tenant with `getTenantId()` and current user with `getCurrentUser()`. Call `createUser(tenantId, body, passwordHash)` from `@repo/core`. Return the created user with status 201 using `serializeUser`. On validation failure return 400 with `validationError`; on email conflict return 409 with `conflict()`.

---

## 3. Handler pattern (what to produce)

Every **contracted** route (users, reminders) must:

1. **Import** request/response schemas and types from `@repo/api-contracts` only. Do not define duplicate Zod schemas or response types in `apps/web` for these endpoints.
2. **Parse** body/query with the contract schema (e.g. `CreateUserBodySchema.safeParse(await request.json())`). Return 400 on failure.
3. **Resolve** tenant and auth (e.g. `getCurrentUser()`, `getTenantId()`).
4. **Call** the use case from `@repo/core` (e.g. `createUser`, `listUsers`, `updateUser`, `getReminder`, …).
5. **Return** a response that matches the contract: use the response type from `@repo/api-contracts` and the app’s serializer so the JSON shape matches the OpenAPI spec.

### Where handlers live

| App         | Path                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| **Next.js** | `apps/web/src/app/api/**/route.ts` (e.g. `api/users/route.ts`, `api/reminders/[id]/route.ts`) |

### Contracted vs non-contracted routes

- **Contracted** (must use `@repo/api-contracts`): `/api/users`, `/api/users/[id]`, `/api/reminders`, `/api/reminders/[id]`.
- **Not contracted** (no contract check): `/api/auth/*`, `/api/me`, etc.

---

## 4. Quick reference: schemas and types

| Resource      | Request body schemas                                   | Response types                              |
| ------------- | ------------------------------------------------------ | ------------------------------------------- |
| **Users**     | `CreateUserBodySchema`, `UpdateUserBodySchema`         | `UserResponse`, `UsersListResponse`         |
| **Reminders** | `CreateReminderBodySchema`, `UpdateReminderBodySchema` | `ReminderResponse`, `RemindersListResponse` |

All are exported from `@repo/api-contracts`. Use the schemas for `.safeParse()` and the types for response typing and serializers.

---

## 5. Regenerating the spec

After changing any schema in `packages/api-contracts`:

```bash
pnpm generate:openapi
```

Run this in CI or before releases so `openapi.json` stays in sync with the contracts.

---

## 6. Single-source enforcement (CI)

Contracted route files **must** import from `@repo/api-contracts` only (no duplicate Zod schemas or response types in `apps/web` for those endpoints).

Run the check from repo root:

```bash
pnpm check:contracts
```

This script verifies that every contracted route file (`api/users/**`, `api/reminders/**`) contains an import from `@repo/api-contracts`. Add `pnpm check:contracts` to your CI pipeline so the single source is enforced.

---

## 7. Optional: response schema validation

To catch mistakes where the handler returns a shape that doesn’t match the contract, you can validate the response body before sending:

- Use the `validateResponse(schema, data)` helper from `@/lib/validate-response`.
- In development (or when `NEXT_PUBLIC_VALIDATE_RESPONSES=1`), it logs a warning if the data doesn’t match the schema; in production it returns the data as-is so behavior is unchanged.

Example (POST /api/users):

```ts
const body = validateResponse(UserResponseSchema, serializeUser(created));
return NextResponse.json(body, { status: 201 });
```

You can adopt this pattern in other contracted handlers for extra safety.
