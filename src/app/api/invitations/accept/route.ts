import { NextResponse } from "next/server";

import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
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
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "You need to log in to accept this invitation.",
        },
        { status: 401 },
      );
    }

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
