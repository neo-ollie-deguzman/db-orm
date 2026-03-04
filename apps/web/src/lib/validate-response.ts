import type { ZodType } from "zod";

/**
 * Optionally validate response data against the contract schema before sending.
 * In development, logs a warning if the data does not match the schema.
 * Set NEXT_PUBLIC_VALIDATE_RESPONSES=1 (or validate in tests) for stricter checks.
 *
 * Usage: const body = validateResponse(UserResponseSchema, serializeUser(created));
 */
export function validateResponse<T>(schema: ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  if (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_VALIDATE_RESPONSES === "1"
  ) {
    console.warn(
      "[validateResponse] Response does not match contract schema:",
      parsed.error.flatten(),
    );
  }
  return data as T;
}
