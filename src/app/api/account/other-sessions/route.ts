import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { rejectUntrustedMutation } from "@/lib/request";
import { getCurrentSessionId } from "@/lib/session";
import { signOutOtherSessions } from "@/services/account.service";

const UNAUTHORIZED_MESSAGE = "You need to log in to sign out other sessions.";

// Signs out every session of this account except the one making the request.
export async function DELETE(request: Request) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

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

    const signedOutSessions = await signOutOtherSessions(auth.user.id, sessionId);

    return NextResponse.json({ signedOutSessions });
  } catch (error) {
    console.error("Signing out other sessions failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to sign out other sessions.",
      },
      { status: 500 },
    );
  }
}
