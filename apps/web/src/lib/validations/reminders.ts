import type { ReminderResponse, ReminderStatus } from "@repo/api-contracts";

/**
 * Serialize a reminder row (and optional user info) to the API response shape.
 * Maps the core `userAvatarUrl` to the API response field.
 */
export function serializeReminder(
  reminder: {
    id: number;
    userId: string;
    note: string;
    status: ReminderStatus;
    reminderDate: Date;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  },
  user?: { name: string; avatarUrl: string | null } | null,
): ReminderResponse {
  return {
    id: reminder.id,
    userId: reminder.userId,
    note: reminder.note,
    status: reminder.status,
    reminderDate: reminder.reminderDate.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
    userName: user?.name ?? "Unknown",
    userAvatarUrl: user?.avatarUrl ?? null,
  };
}
