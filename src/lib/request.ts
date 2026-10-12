import { NextResponse } from "next/server";

import type { RateLimitResult } from "@/lib/rate-limit";

// JSON cannot encode undefined, so undefined always means the body failed to parse.
export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

export function invalidJsonResponse() {
  return NextResponse.json(
    {
      error: "INVALID_JSON",
      message: "The request body must be valid JSON.",
    },
    { status: 400 },
  );
}

export function rateLimitedResponse(
  result: Extract<RateLimitResult, { allowed: false }>,
) {
  const unavailable = result.reason === "UNAVAILABLE";

  return NextResponse.json(
    {
      error: unavailable ? "SERVICE_UNAVAILABLE" : "RATE_LIMITED",
      message: unavailable
        ? "This action is temporarily unavailable. Please try again shortly."
        : "Too many requests. Please wait before trying again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: unavailable ? 503 : 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
