import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import type { RateLimitResult } from "@/lib/rate-limit";

function isJsonContentType(request: Request) {
  const mediaType = request.headers.get("content-type")?.split(";")[0];

  return mediaType?.trim().toLowerCase() === "application/json";
}

// For every state-changing handler outside /api/auth. SameSite cookies are
// the first defense against cross-site requests; this is the second, so a
// request from another origin is refused even if it carries the session
// cookie. Requiring application/json also rules out the form-encoded and
// text/plain bodies another site can send without a CORS preflight.
// Returns a response to send back, or null when the request may proceed.
export function rejectUntrustedMutation(
  request: Request,
  { jsonBody }: { jsonBody: boolean },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "This request came from an untrusted origin.",
      },
      { status: 403 },
    );
  }

  if (jsonBody && !isJsonContentType(request)) {
    return NextResponse.json(
      {
        error: "UNSUPPORTED_MEDIA_TYPE",
        message: "The request body must be sent as application/json.",
      },
      { status: 415 },
    );
  }

  return null;
}

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
