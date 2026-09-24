import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ApiError, ErrorCode } from "@/types/api";

/** Builds the one error shape every API route returns: `{ error: { message, code } }`. */
export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
): NextResponse<ApiError> {
  return NextResponse.json({ error: { message, code } }, { status, headers });
}

export function validationError(error: ZodError): NextResponse<ApiError> {
  return errorResponse(400, "VALIDATION_ERROR", error.errors[0]?.message ?? "Invalid request");
}

export const notFound = (): NextResponse<ApiError> =>
  errorResponse(404, "NOT_FOUND", "Item not found");

export const internalError = (message = "Something went wrong. Please try again."): NextResponse<ApiError> =>
  errorResponse(500, "INTERNAL_ERROR", message);
