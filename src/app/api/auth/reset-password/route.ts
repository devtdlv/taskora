import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import {
  consumeRateLimit,
  getTrustedClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  invalidJsonResponse,
  rateLimitedResponse,
  readJsonBody,
} from "@/lib/request";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPassword } from "@/services/password-reset.service";

const INVALID_TOKEN_RESPONSE = {
  error: "INVALID_OR_EXPIRED_TOKEN",
  message: "This password reset link is invalid or has expired.",
};

// Only POST is exported, so a GET from a link scanner or prefetch gets a 405
// and can't use up the token.
export async function POST(request: Request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "This request came from an untrusted origin.",
        },
        { status: 403 },
      );
    }

    const ip = getTrustedClientIp(request);

    if (ip) {
      const limit = await consumeRateLimit(
        RATE_LIMITS.tokenConsumptionByIp,
        ip,
      );

      if (!limit.allowed) {
        return rateLimitedResponse(limit);
      }
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      const { token, ...fields } = result.error.flatten().fieldErrors;

      // A malformed token gets the same answer as an unknown one.
      if (token) {
        return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
      }

      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields,
        },
        { status: 400 },
      );
    }

    const reset = await resetPassword(result.data.token, result.data.password);

    if (!reset) {
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
    }

    return NextResponse.json({ reset: true });
  } catch (error) {
    console.error("Password reset failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to reset your password.",
      },
      { status: 500 },
    );
  }
}
