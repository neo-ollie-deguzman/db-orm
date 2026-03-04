import { NextRequest, NextResponse } from "next/server";
import { listReminders, createReminder } from "@repo/core";
import { getCurrentUser } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { unauthorized, validationError, internalError } from "@/lib/errors";
import {
  CreateReminderBodySchema,
  type RemindersListResponse,
  type ReminderResponse,
} from "@repo/api-contracts";
import { serializeReminder } from "@/lib/validations/reminders";

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const tenantId = await getTenantId();
    const remindersList = await listReminders(tenantId);

    const body: RemindersListResponse = {
      reminders: remindersList.map((r) =>
        serializeReminder(r, { name: r.userName, avatarUrl: r.userAvatarUrl }),
      ),
      count: remindersList.length,
    };

    return NextResponse.json(body);
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const json = await request.json();
    const parsed = CreateReminderBodySchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { note, reminderDate, status } = parsed.data;
    const tenantId = await getTenantId();

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
  } catch (error) {
    return internalError(error);
  }
}
