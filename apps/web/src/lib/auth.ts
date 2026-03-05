import { auth, type Session } from "@repo/auth";
import { headers } from "next/headers";
import { getTenantId } from "@/lib/tenant";

export type { Session };

/**
 * Returns the full BetterAuth session (user + session metadata) or null.
 * Use in server components, route handlers, and server actions.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Returns the authenticated user if the session is valid and the user
 * belongs to the currently resolved tenant. Returns null otherwise.
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const tenantId = await getTenantId();
  if (session.user.tenantId !== tenantId) return null;

  return session.user;
}

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;
