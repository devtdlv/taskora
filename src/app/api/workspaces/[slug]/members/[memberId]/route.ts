import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { rejectUntrustedMutation } from "@/lib/request";
import { removeWorkspaceMember } from "@/services/workspace.service";

const ERROR_RESPONSES = {
  NOT_FOUND: {
    status: 404,
    message: "Workspace not found.",
  },
  FORBIDDEN: {
    status: 403,
    message: "Only a workspace owner can remove members.",
  },
  MEMBER_NOT_FOUND: {
    status: 404,
    message: "This person is no longer a member of the workspace.",
  },
  CANNOT_REMOVE_SELF: {
    status: 400,
    message: "Use Leave workspace to remove yourself.",
  },
  LAST_OWNER: {
    status: 409,
    message: "A workspace must keep at least one owner.",
  },
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to remove members.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;
    const { slug, memberId } = await params;
    const result = await removeWorkspaceMember(user.id, slug, memberId);

    if (!result.ok) {
      const { status, message } = ERROR_RESPONSES[result.error];

      return NextResponse.json({ error: result.error, message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Member removal failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to remove the member.",
      },
      { status: 500 },
    );
  }
}
