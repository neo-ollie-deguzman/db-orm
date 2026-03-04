const BASE = "http://localhost:3000/api";

let passed = 0;
let failed = 0;

function log(step: string, ok: boolean, detail?: string) {
  const icon = ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${icon}] ${step}${detail ? ` — ${detail}` : ""}`);
  ok ? passed++ : failed++;
}

async function json<T = any>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function run() {
  console.log("\n  API Test Suite\n  ==============\n");

  // ── 1. Create a user ──────────────────────────────────────────────
  const createRes = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      location: "Test City, TC",
    }),
  });
  const created = await json(createRes);
  log(
    "Create user",
    createRes.status === 201 && !!created?.id,
    `status=${createRes.status} id=${created?.id}`,
  );
  const userId: number | undefined = created?.id;

  // ── 2. List users ─────────────────────────────────────────────────
  const listRes = await fetch(`${BASE}/users`);
  const list = await json(listRes);
  const foundInList = list?.users?.some((u: any) => u.id === userId);
  log(
    "List users",
    listRes.status === 200 && foundInList,
    `status=${listRes.status} count=${list?.count} newUserInList=${foundInList}`,
  );

  // ── 3. Get user details ───────────────────────────────────────────
  const getRes = await fetch(`${BASE}/users/${userId}`);
  const detail = await json(getRes);
  log(
    "Get user details",
    getRes.status === 200 && detail?.id === userId,
    `status=${getRes.status} name=${detail?.name}`,
  );

  // ── 4. Update user ────────────────────────────────────────────────
  const updateRes = await fetch(`${BASE}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Updated User",
      location: "Updated City, UC",
    }),
  });
  const updated = await json(updateRes);
  const nameUpdated = updated?.name === "Updated User";
  log(
    "Update user",
    updateRes.status === 200 && nameUpdated,
    `status=${updateRes.status} name=${updated?.name}`,
  );

  // ── 5. Verify updatedAt changed ───────────────────────────────────
  const updatedAtChanged = updated?.updatedAt !== created?.updatedAt;
  log(
    "Verify updatedAt changed",
    updatedAtChanged,
    `before=${created?.updatedAt} after=${updated?.updatedAt}`,
  );

  // ── 6. Soft-delete user ───────────────────────────────────────────
  const deleteRes = await fetch(`${BASE}/users/${userId}`, {
    method: "DELETE",
  });
  log(
    "Soft-delete user",
    deleteRes.status === 204,
    `status=${deleteRes.status}`,
  );

  // ── 7. Verify deleted user returns 404 ────────────────────────────
  const getDeletedRes = await fetch(`${BASE}/users/${userId}`);
  const getDeletedBody = await json(getDeletedRes);
  log(
    "Deleted user returns 404",
    getDeletedRes.status === 404,
    `status=${getDeletedRes.status} error=${getDeletedBody?.error}`,
  );

  // ── 8. Verify deleted user not in list ────────────────────────────
  const listAfterRes = await fetch(`${BASE}/users`);
  const listAfter = await json(listAfterRes);
  const stillInList = listAfter?.users?.some((u: any) => u.id === userId);
  log(
    "Deleted user excluded from list",
    listAfterRes.status === 200 && !stillInList,
    `count=${listAfter?.count} foundDeletedUser=${stillInList}`,
  );

  // ── Validation error test ─────────────────────────────────────────
  const badRes = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "not-an-email" }),
  });
  log(
    "Validation rejects bad input",
    badRes.status === 422,
    `status=${badRes.status}`,
  );

  // ── Summary ───────────────────────────────────────────────────────
  console.log(`\n  ──────────────────────────────────`);
  console.log(
    `  \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m out of ${passed + failed} tests`,
  );
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\n  Test runner crashed:", err.message);
  process.exit(1);
});
