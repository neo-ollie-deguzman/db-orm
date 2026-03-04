import { NextRequest, NextResponse } from "next/server";
import {
  getUser,
  updateUser,
  deleteUser,
  CoreNotFoundError,
  CoreConflictError,
} from "@repo/core";
import { getCurrentUser } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  unauthorized,
  notFound,
  validationError,
  conflict,
  internalError,
  errorResponse,
} from "@/lib/errors";
import { UpdateUserBodySchema, type UserResponse } from "@repo/api-contracts";
import { serializeUser } from "@/lib/validations/users";

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
    const userId = parseId(id);
    if (!userId) return errorResponse(400, "Invalid user ID");

    const tenantId = await getTenantId();
    const user = await getUser(tenantId, userId);

    if (!user) return notFound("User");

    const body: UserResponse = serializeUser(user);
    return NextResponse.json(body);
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const { id } = await params;
    const userId = parseId(id);
    if (!userId) return errorResponse(400, "Invalid user ID");

    const json = await request.json();
    const parsed = UpdateUserBodySchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return errorResponse(400, "No fields to update");
    }

    const tenantId = await getTenantId();

    try {
      const updated = await updateUser(tenantId, userId, updates);
      const body: UserResponse = serializeUser(updated);
      return NextResponse.json(body);
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("User");
      if (e instanceof CoreConflictError) {
        return conflict("A user with that email already exists");
      }
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
    const userId = parseId(id);
    if (!userId) return errorResponse(400, "Invalid user ID");

    const tenantId = await getTenantId();

    try {
      await deleteUser(tenantId, userId);
      return new NextResponse(null, { status: 204 });
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("User");
      throw e;
    }
  } catch (error) {
    return internalError(error);
  }
}
