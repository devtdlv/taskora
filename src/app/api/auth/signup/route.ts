import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { createSession } from "@/lib/session";
import { createUser } from "@/services/auth.service";
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

    return NextResponse.json(
      {
        user,
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