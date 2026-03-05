import { NextRequest, NextResponse } from "next/server";
import {
  getUser,
  updateUser,
  deleteUser,
  CoreNotFoundError,
  CoreConflictError,
} from "@repo/core";
import {
  notFound,
  validationError,
  conflict,
  errorResponse,
} from "@/lib/errors";
import { parseId } from "@/lib/parse-id";
import { withAuth } from "@/lib/with-auth";
import { UpdateUserBodySchema, type UserResponse } from "@repo/api-contracts";
import { serializeUser } from "@/lib/validations/users";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(
  async ({ tenantId }, _request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const userId = parseId(id);
    if (!userId) return errorResponse(400, "Invalid user ID");

    const user = await getUser(tenantId, userId);
    if (!user) return notFound("User");

    const body: UserResponse = serializeUser(user);
    return NextResponse.json(body);
  },
);

export const PATCH = withAuth(
  async ({ tenantId }, request: NextRequest, { params }: RouteContext) => {
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
  },
);

export const DELETE = withAuth(
  async ({ tenantId }, _request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const userId = parseId(id);
    if (!userId) return errorResponse(400, "Invalid user ID");

    try {
      await deleteUser(tenantId, userId);
      return new NextResponse(null, { status: 204 });
    } catch (e) {
      if (e instanceof CoreNotFoundError) return notFound("User");
      throw e;
    }
  },
);
