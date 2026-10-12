import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  invalidJsonResponse,
  rateLimitedResponse,
  readJsonBody,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { resendVerificationSchema } from "@/lib/validations/auth";
import { sendEmailVerification } from "@/services/email-verification.service";

// The email always goes to the signed-in account's own address and the request
// carries no email, so the response can't reveal anything about other accounts.
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

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "You need to log in to verify your email address.",
        },
        { status: 401 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = resendVerificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ status: "already-verified" });
    }

    for (const rule of [
      RATE_LIMITS.verificationResendCooldown,
      RATE_LIMITS.verificationResendDaily,
    ]) {
      const limit = await consumeRateLimit(rule, user.id);

      if (!limit.allowed) {
        return rateLimitedResponse(limit);
      }
    }

    const verification = await sendEmailVerification(user.id);

    if (verification.status === "failed") {
      return NextResponse.json(
        {
          error: "EMAIL_DELIVERY_FAILED",
          message:
            "We couldn't send the verification email. Please try again later.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: verification.status });
  } catch (error) {
    console.error("Verification email resend failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to send the verification email.",
      },
      { status: 500 },
    );
  }
}
