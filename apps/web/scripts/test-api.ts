/**
 * API integration test. Requires dev server and seeded DB.
 * Run: pnpm test:api (from repo root).
 * Uses tenant subdomain (acme.localhost:3000) so sign-in is tenant-scoped; Alice is in acme.
 */
const TENANT_SLUG = "acme";
const BASE_ORIGIN = `http://${TENANT_SLUG}.localhost:3000`;
const BASE = `${BASE_ORIGIN}/api`;
const TENANT_HEADER = { "X-Tenant-Slug": TENANT_SLUG };
const SEED_EMAIL = "alice.johnson@example.com";
const SEED_PASSWORD = "passworD123";

let passed = 0;
let failed = 0;
let cookieHeader: string | null = null;

function log(step: string, ok: boolean, detail?: string) {
  const icon = ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${icon}] ${step}${detail ? ` — ${detail}` : ""}`);
  ok ? passed++ : failed++;
}

async function json<T = unknown>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function defaultHeaders(includeCookie: boolean): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...TENANT_HEADER,
  };
  if (includeCookie && cookieHeader) headers["Cookie"] = cookieHeader;
  return headers;
}

async function run() {
  console.log("\n  API Test Suite\n  ==============\n");

  // ── 0. Sign in (BetterAuth) ───────────────────────────────────────
  const signInRes = await fetch(`${BASE_ORIGIN}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: `${TENANT_SLUG}.localhost:3000`,
      Origin: BASE_ORIGIN,
      Referer: `${BASE_ORIGIN}/login`,
      ...TENANT_HEADER,
    },
    body: JSON.stringify({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
    }),
    redirect: "manual",
  });

  const setCookie = signInRes.headers.get("set-cookie");
  if (setCookie) {
    cookieHeader = (
      typeof signInRes.headers.getSetCookie === "function"
        ? signInRes.headers.getSetCookie()
        : [setCookie]
    )
      .map((c) => c.split(";")[0].trim())
      .join("; ");
  }

  log(
    "Sign in (BetterAuth)",
    signInRes.ok || signInRes.status === 302,
    `status=${signInRes.status} cookie=${cookieHeader ? "set" : "missing"}`,
  );

  if (!cookieHeader) {
    const errBody = await signInRes.text();
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.message) console.log("\n  Server message:", parsed.message);
    } catch {
      if (errBody) console.log("\n  Response:", errBody.slice(0, 200));
    }
    console.log(
      "\n  Cannot continue without session. Ensure dev server is running (pnpm dev) and DB is seeded (pnpm db:seed).",
    );
    process.exit(1);
  }

  // ── 1. Create a user ──────────────────────────────────────────────
  const createRes = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: defaultHeaders(true),
    body: JSON.stringify({
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      location: "Test City, TC",
    }),
  });
  const created = await json<{ id?: string }>(createRes);
  log(
    "Create user",
    createRes.status === 201 && !!created?.id,
    `status=${createRes.status} id=${created?.id}`,
  );
  const userId: string | undefined = created?.id;

  // ── 2. List users ─────────────────────────────────────────────────
  const listRes = await fetch(`${BASE}/users`, {
    headers: defaultHeaders(true),
  });
  const list = await json<{ users?: { id: string }[]; count?: number }>(
    listRes,
  );
  const foundInList = list?.users?.some((u) => u.id === userId);
  log(
    "List users",
    listRes.status === 200 && !!foundInList,
    `status=${listRes.status} count=${list?.count} newUserInList=${!!foundInList}`,
  );

  // ── 3. Get user details ───────────────────────────────────────────
  const getRes = await fetch(`${BASE}/users/${userId}`, {
    headers: defaultHeaders(true),
  });
  const detail = await json<{ id?: string; name?: string }>(getRes);
  log(
    "Get user details",
    getRes.status === 200 && detail?.id === userId,
    `status=${getRes.status} name=${detail?.name}`,
  );

  // ── 4. Update user ────────────────────────────────────────────────
  const updateRes = await fetch(`${BASE}/users/${userId}`, {
    method: "PATCH",
    headers: defaultHeaders(true),
    body: JSON.stringify({
      name: "Updated User",
      location: "Updated City, UC",
    }),
  });
  const updated = await json<{ name?: string; updatedAt?: string }>(updateRes);
  const nameUpdated = updated?.name === "Updated User";
  log(
    "Update user",
    updateRes.status === 200 && nameUpdated,
    `status=${updateRes.status} name=${updated?.name}`,
  );

  // ── 5. Verify updatedAt changed ───────────────────────────────────
  const updatedAtChanged =
    !!created &&
    !!updated &&
    updated?.updatedAt !== (created as { updatedAt?: string })?.updatedAt;
  log(
    "Verify updatedAt changed",
    updatedAtChanged,
    `before=${(created as { updatedAt?: string })?.updatedAt} after=${updated?.updatedAt}`,
  );

  // ── 6. Soft-delete user ───────────────────────────────────────────
  const deleteRes = await fetch(`${BASE}/users/${userId}`, {
    method: "DELETE",
    headers: defaultHeaders(true),
  });
  log(
    "Soft-delete user",
    deleteRes.status === 204,
    `status=${deleteRes.status}`,
  );

  // ── 7. Verify deleted user returns 404 ────────────────────────────
  const getDeletedRes = await fetch(`${BASE}/users/${userId}`, {
    headers: defaultHeaders(true),
  });
  const getDeletedBody = await json<{ error?: string }>(getDeletedRes);
  log(
    "Deleted user returns 404",
    getDeletedRes.status === 404,
    `status=${getDeletedRes.status} error=${getDeletedBody?.error}`,
  );

  // ── 8. Verify deleted user not in list ────────────────────────────
  const listAfterRes = await fetch(`${BASE}/users`, {
    headers: defaultHeaders(true),
  });
  const listAfter = await json<{ users?: { id: string }[]; count?: number }>(
    listAfterRes,
  );
  const stillInList = listAfter?.users?.some((u) => u.id === userId);
  log(
    "Deleted user excluded from list",
    listAfterRes.status === 200 && !stillInList,
    `count=${listAfter?.count} foundDeletedUser=${!!stillInList}`,
  );

  // ── Validation error test (users) ──────────────────────────────────
  const badRes = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: defaultHeaders(true),
    body: JSON.stringify({ name: "", email: "not-an-email" }),
  });
  log(
    "Validation rejects bad user input",
    badRes.status === 422,
    `status=${badRes.status}`,
  );

  // ── Reminders: Create ─────────────────────────────────────────────
  const reminderDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow
  const createReminderRes = await fetch(`${BASE}/reminders`, {
    method: "POST",
    headers: defaultHeaders(true),
    body: JSON.stringify({
      note: "API test reminder",
      reminderDate,
      status: "pending",
    }),
  });
  const createdReminder = await json<{ id?: number; note?: string }>(
    createReminderRes,
  );
  log(
    "Create reminder",
    createReminderRes.status === 201 && typeof createdReminder?.id === "number",
    `status=${createReminderRes.status} id=${createdReminder?.id}`,
  );
  const reminderId: number | undefined = createdReminder?.id;

  // ── Reminders: List ───────────────────────────────────────────────
  const listRemindersRes = await fetch(`${BASE}/reminders`, {
    headers: defaultHeaders(true),
  });
  const listReminders = await json<{
    reminders?: { id: number }[];
    count?: number;
  }>(listRemindersRes);
  const foundInRemindersList = listReminders?.reminders?.some(
    (r) => r.id === reminderId,
  );
  log(
    "List reminders",
    listRemindersRes.status === 200 && !!foundInRemindersList,
    `status=${listRemindersRes.status} count=${listReminders?.count} newReminderInList=${!!foundInRemindersList}`,
  );

  // ── Reminders: Get by id ──────────────────────────────────────────
  const getReminderRes = await fetch(`${BASE}/reminders/${reminderId}`, {
    headers: defaultHeaders(true),
  });
  const reminderDetail = await json<{ id?: number; note?: string }>(
    getReminderRes,
  );
  log(
    "Get reminder details",
    getReminderRes.status === 200 && reminderDetail?.id === reminderId,
    `status=${getReminderRes.status} note=${reminderDetail?.note}`,
  );

  // ── Reminders: Update ──────────────────────────────────────────────
  const updateReminderRes = await fetch(`${BASE}/reminders/${reminderId}`, {
    method: "PATCH",
    headers: defaultHeaders(true),
    body: JSON.stringify({
      note: "Updated API test reminder",
      status: "completed",
    }),
  });
  const updatedReminder = await json<{ note?: string; status?: string }>(
    updateReminderRes,
  );
  const reminderNoteUpdated =
    updatedReminder?.note === "Updated API test reminder";
  log(
    "Update reminder",
    updateReminderRes.status === 200 && reminderNoteUpdated,
    `status=${updateReminderRes.status} note=${updatedReminder?.note}`,
  );

  // ── Reminders: Delete ──────────────────────────────────────────────
  const deleteReminderRes = await fetch(`${BASE}/reminders/${reminderId}`, {
    method: "DELETE",
    headers: defaultHeaders(true),
  });
  log(
    "Delete reminder",
    deleteReminderRes.status === 204,
    `status=${deleteReminderRes.status}`,
  );

  // ── Reminders: Deleted returns 404 ─────────────────────────────────
  const getDeletedReminderRes = await fetch(`${BASE}/reminders/${reminderId}`, {
    headers: defaultHeaders(true),
  });
  const getDeletedReminderBody = await json<{ error?: string }>(
    getDeletedReminderRes,
  );
  log(
    "Deleted reminder returns 404",
    getDeletedReminderRes.status === 404,
    `status=${getDeletedReminderRes.status} error=${getDeletedReminderBody?.error}`,
  );

  // ── Reminders: Validation error ─────────────────────────────────────
  const badReminderRes = await fetch(`${BASE}/reminders`, {
    method: "POST",
    headers: defaultHeaders(true),
    body: JSON.stringify({
      note: "",
      reminderDate: "not-a-datetime",
    }),
  });
  log(
    "Validation rejects bad reminder input",
    badReminderRes.status === 422,
    `status=${badReminderRes.status}`,
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
