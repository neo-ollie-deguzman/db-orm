import { z } from "zod";

export const reminderStatuses = ["pending", "completed", "dismissed"] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

/** Request body for creating a reminder (reminderDate as ISO 8601 string; userId set by server). */
export const CreateReminderBodySchema = z.object({
  note: z
    .string()
    .min(1, "Note is required")
    .max(1000, "Note must be 1000 characters or fewer"),
  reminderDate: z
    .string()
    .datetime({ message: "Must be a valid ISO 8601 date-time string" }),
  status: z.enum(reminderStatuses).optional(),
});

/** Request body for updating a reminder (all fields optional). */
export const UpdateReminderBodySchema = z.object({
  note: z
    .string()
    .min(1, "Note is required")
    .max(1000, "Note must be 1000 characters or fewer")
    .optional(),
  reminderDate: z
    .string()
    .datetime({ message: "Must be a valid ISO 8601 date-time string" })
    .optional(),
  status: z.enum(reminderStatuses).optional(),
});

/** Single reminder in API responses (dates as ISO strings). */
export const ReminderResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  note: z.string(),
  status: z.enum(reminderStatuses),
  reminderDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userName: z.string(),
  userAvatarUrl: z.string().nullable(),
});

/** Response for GET /api/reminders (list). */
export const RemindersListResponseSchema = z.object({
  reminders: z.array(ReminderResponseSchema),
  count: z.number(),
});

/** Query params for list reminders (optional; for future filtering). */
export const ListRemindersQuerySchema = z.object({
  status: z.enum(reminderStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateReminderBody = z.infer<typeof CreateReminderBodySchema>;
export type UpdateReminderBody = z.infer<typeof UpdateReminderBodySchema>;
export type ReminderResponse = z.infer<typeof ReminderResponseSchema>;
export type RemindersListResponse = z.infer<typeof RemindersListResponseSchema>;
export type ListRemindersQuery = z.infer<typeof ListRemindersQuerySchema>;
