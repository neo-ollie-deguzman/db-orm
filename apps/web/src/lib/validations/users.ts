import type { UserResponse } from "@repo/api-contracts";

/**
 * Serialize a user row to the API response shape (matches UserResponseSchema).
 */
export function serializeUser(user: {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    location: user.location,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
