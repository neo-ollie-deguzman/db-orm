import { cookies } from "next/headers";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { verifyJwt, type JwtSessionPayload } from "@repo/auth";
import { authenticate as coreAuthenticate, getUser } from "@repo/core";
import { getTenantId } from "@/lib/tenant";

const SESSION_COOKIE = "session";
const JWT_EXPIRES_IN = "24h";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload extends JwtSessionPayload {}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  payload: Omit<SessionPayload, "iat" | "exp">,
) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getJwtSecret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return token;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function verifySession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const context = await verifyJwt(token, getJwtSecret());
  if (!context || context.userId === undefined) return null;

  return {
    userId: context.userId,
    tenantId: context.tenantId,
    email: context.email ?? "",
  } as SessionPayload;
}

/**
 * Verifies a JWT token string directly (e.g. for middleware where cookies() isn't available).
 */
export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  const context = await verifyJwt(token, getJwtSecret());
  if (!context || context.userId === undefined) return null;

  return {
    userId: context.userId,
    tenantId: context.tenantId,
    email: context.email ?? "",
  } as SessionPayload;
}

/**
 * Authenticates by email and password within the given tenant.
 * Returns the user row on success, null on failure. Uses @repo/core.
 */
export async function authenticate(
  tenantId: string,
  email: string,
  password: string,
) {
  return coreAuthenticate(tenantId, email, password);
}

/**
 * Returns the current authenticated user from the session JWT.
 * Uses @repo/auth for JWT verify and @repo/core for loading user.
 */
export async function getCurrentUser() {
  const session = await verifySession();
  if (!session) return null;

  const tenantId = await getTenantId();
  if (session.tenantId !== tenantId) return null;

  return getUser(tenantId, session.userId);
}

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;
