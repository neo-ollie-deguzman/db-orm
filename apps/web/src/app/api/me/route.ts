import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized, internalError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

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
