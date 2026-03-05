import { NextRequest, NextResponse } from "next/server";
import {
  CreateUserBodySchema,
  UserResponseSchema,
  type UsersListResponse,
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
import crypto from "node:crypto";

export const GET = withAuth(async ({ tenantId }) => {
  const rows = await listUsers(tenantId);

  const body: UsersListResponse = {
    users: rows.map(serializeUser),
    count: rows.length,
  };

  return NextResponse.json(body);
});

export const POST = withAuth(async ({ tenantId }, request: NextRequest) => {
  const json = await request.json();
  const parsed = CreateUserBodySchema.safeParse(json);

    const { name, email, avatarUrl, location } = parsed.data;
    const tenantId = await getTenantId();

    try {
      const created = await createUser(tenantId, {
        name,
        email,
        image: avatarUrl ?? null,
        location,
      });

  try {
    const created = await createUser(
      tenantId,
      { name, email, avatarUrl, location },
      passwordHash,
    );

    const body = validateResponse(UserResponseSchema, serializeUser(created));
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    if (e instanceof CoreConflictError) {
      return conflict("A user with that email already exists");
    }
    throw e;
  }
});
