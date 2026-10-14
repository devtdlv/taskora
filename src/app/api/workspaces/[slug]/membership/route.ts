import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { rejectUntrustedMutation } from "@/lib/request";
import { leaveWorkspace } from "@/services/workspace.service";

const ERROR_RESPONSES = {
  NOT_FOUND: {
    status: 404,
    message: "Workspace not found.",
  },
  LAST_OWNER: {
    status: 409,
    message:
      "You're the only owner of this workspace, so you can't leave it.",
  },
};

// Deletes the signed-in user's own membership, which is how leaving works.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to leave a workspace.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;
    const { slug } = await params;
    const result = await leaveWorkspace(user.id, slug);

    if (!result.ok) {
      const { status, message } = ERROR_RESPONSES[result.error];

      return NextResponse.json({ error: result.error, message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Leaving workspace failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to leave the workspace.",
      },
      { status: 500 },
    );
  }
}
