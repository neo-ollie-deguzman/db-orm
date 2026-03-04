import { jwtVerify, type JWTPayload } from "jose";

/**
 * Standard claims we expect in a session JWT (tenant + user).
 */
export interface JwtSessionPayload extends JWTPayload {
  userId: number;
  tenantId: string;
  email: string;
}

/**
 * Result of successful JWT verification. Use for tenant context in API handlers.
 */
export interface AuthContext {
  tenantId: string;
  userId?: number;
  email?: string;
  scopes?: string[];
}

/**
 * Verifies a JWT token and returns the payload as auth context.
 * Secret can be a string (UTF-8 encoded) or Uint8Array.
 * Returns null if token is missing, invalid, or expired.
 */
export async function verifyJwt(
  token: string,
  secret: string | Uint8Array,
): Promise<AuthContext | null> {
  if (!token.trim()) return null;

  const key =
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret;

  try {
    const { payload } = await jwtVerify(token, key);
    const p = payload as JwtSessionPayload;

    if (!p.tenantId || typeof p.tenantId !== "string") return null;

    return {
      tenantId: p.tenantId,
      userId: typeof p.userId === "number" ? p.userId : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
    };
  } catch {
    return null;
  }
}
