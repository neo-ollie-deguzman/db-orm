import type { UserResponse } from "@repo/api-contracts";

/**
 * Serialize a user row to the API response shape (matches UserResponseSchema).
 * Maps the Drizzle `image` property to the API `avatarUrl` field.
 */
export function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  image: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.image,
    location: user.location,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
