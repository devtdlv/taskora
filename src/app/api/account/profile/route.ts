import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { updateProfileSchema } from "@/lib/validations/auth";
import { updateDisplayName } from "@/services/account.service";

const UNAUTHORIZED_MESSAGE = "You need to log in to update your profile.";

export async function PATCH(request: Request) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(UNAUTHORIZED_MESSAGE);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updated = await updateDisplayName(auth.user.id, result.data.name);

    if (!updated) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE },
        { status: 401 },
      );
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Profile update failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update your profile.",
      },
      { status: 500 },
    );
  }
}
