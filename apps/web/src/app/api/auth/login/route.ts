import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { validationError, internalError, errorResponse } from "@/lib/errors";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = loginSchema.safeParse(json);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { email, password } = parsed.data;
    const tenantId = await getTenantId();

    const user = await authenticate(tenantId, email, password);
    if (!user) {
      return errorResponse(401, "Invalid email or password");
    }

    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    return internalError(error);
  }
}
