import { NextRequest, NextResponse } from "next/server";
import {
  getReminder,
  updateReminder,
  deleteReminder,
  CoreNotFoundError,
} from "@repo/core";
import { notFound, validationError, errorResponse } from "@/lib/errors";
import { parseId } from "@/lib/parse-id";
import { withAuth } from "@/lib/with-auth";
import {
  UpdateReminderBodySchema,
  type ReminderResponse,
} from "@repo/api-contracts";
import { serializeReminder } from "@/lib/validations/reminders";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(
  async ({ tenantId }, _request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const reminderId = parseId(id);
    if (!reminderId) return errorResponse(400, "Invalid reminder ID");

    try {
      const row = await getReminder(tenantId, reminderId);
      const body: ReminderResponse = serializeReminder(row, {
        name: row.userName,
        avatarUrl: row.userAvatarUrl,
      });
      return NextResponse.json(body);
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("Reminder");
      throw e;
    }
  },
);

export const PATCH = withAuth(
  async ({ tenantId }, request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const reminderId = parseId(id);
    if (!reminderId) return errorResponse(400, "Invalid reminder ID");

    const json = await request.json();
    const parsed = UpdateReminderBodySchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return errorResponse(400, "No fields to update");
    }

    try {
      const updated = await updateReminder(tenantId, reminderId, {
        ...updates,
        reminderDate: updates.reminderDate
          ? new Date(updates.reminderDate)
          : undefined,
      });
      const body: ReminderResponse = serializeReminder(updated, {
        name: updated.userName,
        avatarUrl: updated.userAvatarUrl,
      });
      return NextResponse.json(body);
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("Reminder");
      throw e;
    }
  },
);

export const DELETE = withAuth(
  async ({ tenantId }, _request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const reminderId = parseId(id);
    if (!reminderId) return errorResponse(400, "Invalid reminder ID");

    try {
      await deleteReminder(tenantId, reminderId);
      return new NextResponse(null, { status: 204 });
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("Reminder");
      throw e;
    }
  },
);
