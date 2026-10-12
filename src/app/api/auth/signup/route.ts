import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { createSession } from "@/lib/session";
import { createUser } from "@/services/auth.service";
import { sendEmailVerification } from "@/services/email-verification.service";
import { signupSchema } from "@/lib/validations/auth";

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

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const user = await createUser(result.data);

    await createSession(user.id, false);

    // The account already exists, so a delivery problem doesn't fail signup.
    // The user can request another email once they're signed in.
    let verificationEmail: "sent" | "failed" = "failed";

    try {
      const verification = await sendEmailVerification(user.id);
      verificationEmail = verification.status === "sent" ? "sent" : "failed";
    } catch (error) {
      console.error("Verification email after signup failed:", error);
    }

    return NextResponse.json(
      {
        user,
        verificationEmail,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          error: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }

    console.error("Signup failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create your account.",
      },
      { status: 500 },
    );
  }
}