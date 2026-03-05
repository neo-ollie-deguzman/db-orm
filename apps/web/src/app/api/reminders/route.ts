import { NextRequest, NextResponse } from "next/server";
import { listReminders, createReminder } from "@repo/core";
import { validationError } from "@/lib/errors";
import { withAuth } from "@/lib/with-auth";
import {
  CreateReminderBodySchema,
  type RemindersListResponse,
  type ReminderResponse,
} from "@repo/api-contracts";
import { serializeReminder } from "@/lib/validations/reminders";

export const GET = withAuth(async ({ tenantId }) => {
  const remindersList = await listReminders(tenantId);

  const body: RemindersListResponse = {
    reminders: remindersList.map((r) =>
      serializeReminder(r, { name: r.userName, avatarUrl: r.userAvatarUrl }),
    ),
    count: remindersList.length,
  };

  return NextResponse.json(body);
});

export const POST = withAuth(
  async ({ currentUser, tenantId }, request: NextRequest) => {
    const json = await request.json();
    const parsed = CreateReminderBodySchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { note, reminderDate, status } = parsed.data;

    const created = await createReminder(tenantId, {
      note,
      reminderDate: new Date(reminderDate),
      status,
      userId: currentUser.id,
    });

    const body: ReminderResponse = serializeReminder(created, {
      name: created.userName,
      avatarUrl: created.userAvatarUrl,
    });
    return NextResponse.json(body, { status: 201 });
  },
);
