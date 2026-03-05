import { and, eq } from "drizzle-orm";
import { reminders, users, withTenant } from "@repo/db";
import type {
  CreateReminderInput,
  ReminderWithUser,
  UpdateReminderInput,
} from "./types";
import { CoreNotFoundError } from "./errors";

function rowToReminderWithUser(
  reminder: typeof reminders.$inferSelect,
  userName: string | null,
  userImage: string | null,
): ReminderWithUser {
  return {
    ...reminder,
    userName: userName ?? "Unknown",
    userImage: userImage ?? null,
  };
}

/**
 * List all non-deleted reminders for the tenant, ordered by reminder date.
 */
export async function listReminders(
  tenantId: string,
): Promise<ReminderWithUser[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        reminder: reminders,
        userName: users.name,
        userImage: users.image,
      })
      .from(reminders)
      .leftJoin(users, eq(reminders.userId, users.id))
      .where(eq(reminders.isDeleted, false))
      .orderBy(reminders.reminderDate),
  );

  return rows.map((r) =>
    rowToReminderWithUser(r.reminder, r.userName, r.userImage),
  );
}

/**
 * Create a reminder for the tenant. Returns the created reminder with user info.
 */
export async function createReminder(
  tenantId: string,
  input: CreateReminderInput,
): Promise<ReminderWithUser> {
  const { note, reminderDate, status, userId } = input;

  const [created] = await withTenant(tenantId, async (tx) =>
    tx
      .insert(reminders)
      .values({
        tenantId,
        userId,
        note,
        reminderDate,
        ...(status ? { status } : {}),
      })
      .returning(),
  );

  if (!created) throw new Error("Insert did not return row");

  const [userRow] = await withTenant(tenantId, (tx) =>
    tx
      .select({ name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, created.userId))
      .limit(1),
  );

  return rowToReminderWithUser(
    created,
    userRow?.name ?? null,
    userRow?.image ?? null,
  );
}

/**
 * Get a single reminder by id. Throws CoreNotFoundError if not found.
 */
export async function getReminder(
  tenantId: string,
  id: number,
): Promise<ReminderWithUser> {
  const row = await withTenant(tenantId, async (tx) => {
    const [r] = await tx
      .select({
        reminder: reminders,
        userName: users.name,
        userImage: users.image,
      })
      .from(reminders)
      .leftJoin(users, eq(reminders.userId, users.id))
      .where(and(eq(reminders.id, id), eq(reminders.isDeleted, false)))
      .limit(1);
    return r ?? null;
  });

  if (!row) throw new CoreNotFoundError("Reminder");

  return rowToReminderWithUser(row.reminder, row.userName, row.userImage);
}

/**
 * Update a reminder. Throws CoreNotFoundError if not found.
 */
export async function updateReminder(
  tenantId: string,
  id: number,
  input: UpdateReminderInput,
): Promise<ReminderWithUser> {
  const { reminderDate, ...rest } = input;

  const result = await withTenant(tenantId, async (tx) => {
    const [existing] = await tx
      .select({
        reminder: reminders,
        userName: users.name,
        userImage: users.image,
      })
      .from(reminders)
      .leftJoin(users, eq(reminders.userId, users.id))
      .where(and(eq(reminders.id, id), eq(reminders.isDeleted, false)))
      .limit(1);

    if (!existing) return { notFound: true as const };

    const [updated] = await tx
      .update(reminders)
      .set({
        ...rest,
        ...(reminderDate !== undefined ? { reminderDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(reminders.id, id))
      .returning();

    if (!updated) return { notFound: true as const };

    return {
      reminder: updated,
      userName: existing.userName,
      userImage: existing.userImage,
    };
  });

  if ("notFound" in result) throw new CoreNotFoundError("Reminder");

  return rowToReminderWithUser(
    result.reminder,
    result.userName,
    result.userImage,
  );
}

/**
 * Soft-delete a reminder. Throws CoreNotFoundError if not found.
 */
export async function deleteReminder(
  tenantId: string,
  id: number,
): Promise<void> {
  const result = await withTenant(tenantId, async (tx) => {
    const [existing] = await tx
      .select({ id: reminders.id })
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.isDeleted, false)))
      .limit(1);

    if (!existing) return { notFound: true as const };

    await tx
      .update(reminders)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(reminders.id, id));

    return { deleted: true as const };
  });

  if ("notFound" in result) throw new CoreNotFoundError("Reminder");
}
