import { NextResponse } from "next/server";

import { isTrustedOrigin } from "@/lib/origin";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";
import { verifyCredentials } from "@/services/auth.service";

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

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const user = await verifyCredentials(result.data);

    if (!user) {
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: "Incorrect email or password.",
        },
        { status: 401 },
      );
    }

    await createSession(user.id, result.data.remember);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to log you in.",
      },
      { status: 500 },
    );
  }
}
