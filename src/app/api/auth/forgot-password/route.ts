import { after, NextResponse } from "next/server";

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
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/services/password-reset.service";

const ACCEPTED_RESPONSE = {
  status: "accepted",
  message:
    "If an account exists for that email, we'll send a link to reset the password.",
};

// The response is identical whether or not the account exists. The lookup,
// token, and email all run after the response is sent, so its timing doesn't
// reveal the answer either.
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
      const limit = await consumeRateLimit(RATE_LIMITS.passwordResetByIp, ip);

      if (!limit.allowed) {
        return rateLimitedResponse(limit);
      }
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email } = result.data;

    // Counted for every address, registered or not, so hitting the limit
    // says nothing about the account.
    const limit = await consumeRateLimit(
      RATE_LIMITS.passwordResetByEmail,
      email,
    );

    if (!limit.allowed) {
      return rateLimitedResponse(limit);
    }

    after(async () => {
      try {
        await requestPasswordReset(email);
      } catch (error) {
        console.error("Password reset request failed:", error);
      }
    });

    return NextResponse.json(ACCEPTED_RESPONSE);
  } catch (error) {
    console.error("Password reset request failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to process your request.",
      },
      { status: 500 },
    );
  }
}
