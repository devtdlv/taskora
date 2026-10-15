import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  invalidJsonResponse,
  rateLimitedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { getCurrentSessionId } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword } from "@/services/account.service";

const UNAUTHORIZED_MESSAGE = "You need to log in to change your password.";

// Changes the password and signs out every other session. The session making
// the request stays signed in.
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(UNAUTHORIZED_MESSAGE);

    if (!auth.ok) {
      return auth.response;
    }

    const sessionId = await getCurrentSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE },
        { status: 401 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Counted before the password is checked, so every guess uses up an
    // attempt.
    const limit = await consumeRateLimit(
      RATE_LIMITS.passwordChangeByUser,
      auth.user.id,
    );

    if (!limit.allowed) {
      return rateLimitedResponse(limit);
    }

    const change = await changePassword(auth.user.id, sessionId, result.data);

    if (!change.ok) {
      return NextResponse.json(
        {
          error: "INVALID_CURRENT_PASSWORD",
          fields: { currentPassword: ["Your current password is incorrect."] },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      changed: true,
      signedOutSessions: change.signedOutSessions,
    });
  } catch (error) {
    console.error("Password change failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to change your password.",
      },
      { status: 500 },
    );
  }
}
