import { NextRequest, NextResponse } from "next/server";
import {
  CreateUserBodySchema,
  UserResponseSchema,
  type UsersListResponse,
  type UserResponse,
} from "@repo/api-contracts";
import { listUsers, createUser, CoreConflictError } from "@repo/core";
import { getCurrentUser } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import {
  unauthorized,
  validationError,
  conflict,
  internalError,
} from "@/lib/errors";
import { validateResponse } from "@/lib/validate-response";
import { serializeUser } from "@/lib/validations/users";

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const tenantId = await getTenantId();
    const rows = await listUsers(tenantId);

    const body: UsersListResponse = {
      users: rows.map(serializeUser),
      count: rows.length,
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
    const parsed = CreateUserBodySchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, email, avatarUrl, location } = parsed.data;
    const tenantId = await getTenantId();

    try {
      const created = await createUser(tenantId, {
        name,
        email,
        image: avatarUrl ?? null,
        location,
      });

      const body = validateResponse(UserResponseSchema, serializeUser(created));
      return NextResponse.json(body, { status: 201 });
    } catch (e) {
      if (e instanceof CoreConflictError) {
        return conflict("A user with that email already exists");
      }
      throw e;
    }
  } catch (error) {
    return internalError(error);
  }
}
