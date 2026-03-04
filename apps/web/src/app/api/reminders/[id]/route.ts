import { NextRequest, NextResponse } from "next/server";
import {
  getReminder,
  updateReminder,
  deleteReminder,
  CoreNotFoundError,
} from "@repo/core";
import { getCurrentUser } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  unauthorized,
  notFound,
  validationError,
  errorResponse,
  internalError,
} from "@/lib/errors";
import {
  UpdateReminderBodySchema,
  type ReminderResponse,
} from "@repo/api-contracts";
import { serializeReminder } from "@/lib/validations/reminders";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const { id } = await params;
    const reminderId = parseId(id);
    if (!reminderId) return errorResponse(400, "Invalid reminder ID");

    const tenantId = await getTenantId();

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
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

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

    const tenantId = await getTenantId();

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
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const { id } = await params;
    const reminderId = parseId(id);
    if (!reminderId) return errorResponse(400, "Invalid reminder ID");

    const tenantId = await getTenantId();

    try {
      await deleteReminder(tenantId, reminderId);
      return new NextResponse(null, { status: 204 });
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("Reminder");
      throw e;
    }
  } catch (error) {
    return internalError(error);
  }
}
