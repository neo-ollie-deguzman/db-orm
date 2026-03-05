import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorResponse = {
  error: string;
  details?: unknown;
};

export function errorResponse(
  status: number,
  error: string,
  details?: unknown,
) {
  const body: ErrorResponse = { error };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export function notFound(resource = "Resource") {
  return errorResponse(404, `${resource} not found`);
}

export function validationError(error: ZodError) {
  return errorResponse(422, "Validation failed", formatZodErrors(error));
}

export function unauthorized(message = "Unauthorized") {
  return errorResponse(401, message);
}

export function conflict(message: string) {
  return errorResponse(409, message);
}

export function internalError(error: unknown) {
  console.error("[API Error]", error);
  return errorResponse(500, "Internal server error");
}

function formatZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
}
