import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { rejectUntrustedMutation } from "@/lib/request";
import { revokeWorkspaceInvitation } from "@/services/invitation.service";

const ERROR_RESPONSES = {
  NOT_FOUND: {
    status: 404,
    message: "Workspace not found.",
  },
  FORBIDDEN: {
    status: 403,
    message: "Only a workspace owner can revoke invitations.",
  },
  INVITATION_NOT_FOUND: {
    status: 404,
    message: "This invitation is no longer pending.",
  },
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; invitationId: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to revoke invitations.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;
    const { slug, invitationId } = await params;
    const result = await revokeWorkspaceInvitation(user.id, slug, invitationId);

    if (!result.ok) {
      const { status, message } = ERROR_RESPONSES[result.error];

      return NextResponse.json({ error: result.error, message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Invitation revocation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to revoke the invitation.",
      },
      { status: 500 },
    );
  }
}
