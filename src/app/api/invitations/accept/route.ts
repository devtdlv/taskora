import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { acceptInvitationSchema } from "@/lib/validations/invitation";
import { acceptWorkspaceInvitation } from "@/services/invitation.service";

const ERROR_RESPONSES = {
  INVALID_INVITATION: {
    status: 404,
    message: "This invitation link is invalid.",
  },
  EMAIL_MISMATCH: {
    status: 403,
    message: "This invitation was sent to a different email address.",
  },
  INVITATION_EXPIRED: {
    status: 410,
    message: "This invitation has expired.",
  },
  INVITATION_USED: {
    status: 409,
    message: "This invitation has already been used.",
  },
  EMAIL_NOT_VERIFIED: {
    status: 403,
    message: "Verify your email address to accept this invitation.",
  },
};

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to accept this invitation.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = acceptInvitationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "INVALID_INVITATION",
          message: ERROR_RESPONSES.INVALID_INVITATION.message,
        },
        { status: 400 },
      );
    }

    const acceptance = await acceptWorkspaceInvitation(user, result.data.token);

    if (!acceptance.ok) {
      const { status, message } = ERROR_RESPONSES[acceptance.error];

      return NextResponse.json(
        {
          error: acceptance.error,
          message,
        },
        { status },
      );
    }

    return NextResponse.json({
      workspace: {
        slug: acceptance.workspaceSlug,
      },
    });
  } catch (error) {
    console.error("Invitation acceptance failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to accept the invitation.",
      },
      { status: 500 },
    );
  }
}
