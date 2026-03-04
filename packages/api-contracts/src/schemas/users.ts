import { z } from "zod";

/** Request body for creating a user. */
export const CreateUserBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(255, "Email must be 255 characters or fewer"),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .max(2048, "Avatar URL must be 2048 characters or fewer")
    .nullish(),
  location: z
    .string()
    .max(255, "Location must be 255 characters or fewer")
    .nullish(),
});

/** Request body for updating a user (all fields optional). */
export const UpdateUserBodySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be 255 characters or fewer")
    .optional(),
  avatarUrl: z
    .string()
    .url("Invalid URL")
    .max(2048, "Avatar URL must be 2048 characters or fewer")
    .nullish(),
  location: z
    .string()
    .max(255, "Location must be 255 characters or fewer")
    .nullish(),
});

/** Single user in API responses (no password, dates as ISO strings). */
export const UserResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  location: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Response for GET /api/users (list). */
export const UsersListResponseSchema = z.object({
  users: z.array(UserResponseSchema),
  count: z.number(),
});

export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UsersListResponse = z.infer<typeof UsersListResponseSchema>;
