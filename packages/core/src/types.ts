/** Status values for reminders (matches DB enum). */
export type ReminderStatus = "pending" | "completed" | "dismissed";

/** Input for creating a reminder. userId is the authenticated user creating it. */
export interface CreateReminderInput {
  note: string;
  reminderDate: Date;
  status?: ReminderStatus;
  userId: string;
}

/** Input for updating a reminder (all fields optional). */
export interface UpdateReminderInput {
  note?: string;
  reminderDate?: Date;
  status?: ReminderStatus;
}

/** Reminder row plus optional user display info for list/get. */
export interface ReminderWithUser {
  id: number;
  tenantId: string;
  userId: string;
  note: string;
  status: ReminderStatus;
  reminderDate: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  userName: string;
  userAvatarUrl: string | null;
}

/** Input for creating a user via the admin API (BetterAuth handles sign-up). */
export interface CreateUserInput {
  name: string;
  email: string;
  image?: string | null;
  location?: string | null;
}

/** Input for updating a user (all optional). */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  image?: string | null;
  location?: string | null;
}
