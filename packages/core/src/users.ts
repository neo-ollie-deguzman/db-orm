import { and, eq, ne } from "drizzle-orm";
import { users, withTenant } from "@repo/db";
import type { CreateUserInput, UpdateUserInput } from "./types";
import { CoreConflictError, CoreNotFoundError } from "./errors";

export type UserRow = typeof users.$inferSelect;

/**
 * List all non-deleted users for the tenant.
 */
export async function listUsers(tenantId: string): Promise<UserRow[]> {
  return withTenant(tenantId, (tx) =>
    tx.select().from(users).where(eq(users.isDeleted, false)).orderBy(users.id),
  );
}

/**
 * Get a single user by id. Returns null if not found.
 */
export async function getUser(
  tenantId: string,
  userId: string,
): Promise<UserRow | null> {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .limit(1),
  );
  return row ?? null;
}

/**
 * Create a user record in the tenant.
 * Note: BetterAuth handles sign-up and password management via the accounts table.
 * This function is for admin-level user creation within the app.
 */
export async function createUser(
  tenantId: string,
  input: CreateUserInput,
): Promise<UserRow> {
  const { name, email, image, location } = input;

  const result = await withTenant(tenantId, async (tx) => {
    const [duplicate] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.isDeleted, false)))
      .limit(1);

    if (duplicate) return { conflict: true as const };

    const [created] = await tx
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        name,
        email,
        image: image ?? null,
        location: location ?? null,
      })
      .returning();

    return { created: created! };
  });

  if ("conflict" in result) {
    throw new CoreConflictError("A user with that email already exists");
  }

  return result.created;
}

/**
 * Update a user. Throws CoreNotFoundError if not found, CoreConflictError if new email is taken.
 */
export async function updateUser(
  tenantId: string,
  id: string,
  input: UpdateUserInput,
): Promise<UserRow> {
  const result = await withTenant(tenantId, async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.isDeleted, false)))
      .limit(1);

    if (!user) return { notFound: true as const };

    if (input.email !== undefined) {
      const [duplicate] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, input.email),
            eq(users.isDeleted, false),
            ne(users.id, id),
          ),
        )
        .limit(1);

      if (duplicate) return { conflict: true as const };
    }

    const [updated] = await tx
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return { updated: updated! };
  });

  if ("notFound" in result) throw new CoreNotFoundError("User");
  if ("conflict" in result) {
    throw new CoreConflictError("A user with that email already exists");
  }

  return result.updated;
}

/**
 * Soft-delete a user. Throws CoreNotFoundError if not found.
 */
export async function deleteUser(tenantId: string, id: string): Promise<void> {
  const result = await withTenant(tenantId, async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.isDeleted, false)))
      .limit(1);

    if (!user) return { notFound: true as const };

    await tx
      .update(users)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));

    return { deleted: true as const };
  });

  if ("notFound" in result) throw new CoreNotFoundError("User");
}
