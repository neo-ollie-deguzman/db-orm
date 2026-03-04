/**
 * @repo/core — shared business logic. Use-case functions take (tenantId, input)
 * and use @repo/db inside withTenant(). No HTTP or framework types.
 */
export { CoreConflictError, CoreNotFoundError } from "./errors";
export type {
  CreateReminderInput,
  CreateUserInput,
  ReminderWithUser,
  ReminderStatus,
  UpdateReminderInput,
  UpdateUserInput,
} from "./types";
export {
  createReminder,
  deleteReminder,
  getReminder,
  listReminders,
  updateReminder,
} from "./reminders";
export {
  authenticate,
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
  type UserRow,
} from "./users";
