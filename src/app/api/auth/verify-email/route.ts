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
import { verifyEmailSchema } from "@/lib/validations/auth";
import { confirmEmailVerification } from "@/services/email-verification.service";

const INVALID_TOKEN_RESPONSE = {
  error: "INVALID_OR_EXPIRED_TOKEN",
  message: "This verification link is invalid or has expired.",
};

// Only POST is exported, so a GET from a link scanner or prefetch gets a 405
// and can't use up the token. The token itself is proof of ownership, so no
// session is required.
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

    // Tokens can't be guessed, so this mainly limits load. Without a trusted
    // client IP there's nothing safe to key it on.
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

    const result = verifyEmailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
    }

    const verified = await confirmEmailVerification(result.data.token);

    if (!verified) {
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 400 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Email verification failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to verify your email address.",
      },
      { status: 500 },
    );
  }
}
