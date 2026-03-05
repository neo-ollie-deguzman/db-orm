import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { unauthorized, internalError } from "@/lib/errors";

export type AuthContext = {
  currentUser: CurrentUser;
  tenantId: string;
};

/**
 * Wraps an API route handler with authentication, tenant resolution,
 * and top-level error handling. Eliminates the repeated boilerplate of
 * checking auth, resolving the tenant, and catching unexpected errors.
 */
export function withAuth<Args extends unknown[]>(
  handler: (ctx: AuthContext, ...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return unauthorized();

      const tenantId = await getTenantId();
      return await handler({ currentUser, tenantId }, ...args);
    } catch (error) {
      return internalError(error);
    }
  };
}
