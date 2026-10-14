import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { createInvitationSchema } from "@/lib/validations/invitation";
import { createWorkspaceInvitation } from "@/services/invitation.service";
import { getWorkspaceMembership } from "@/services/workspace.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to invite members.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { slug } = await params;
    const membership = await getWorkspaceMembership(user.id, slug);

    if (!membership) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Workspace not found.",
        },
        { status: 404 },
      );
    }

    if (membership.role !== "OWNER") {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Only the workspace owner can invite members.",
        },
        { status: 403 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = createInvitationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const invitation = await createWorkspaceInvitation(
      membership.workspace.id,
      result.data.email,
    );

    return NextResponse.json(
      {
        invitation: {
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          url: new URL(`/invite/${invitation.token}`, request.url).toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_MEMBER") {
      return NextResponse.json(
        {
          error: "ALREADY_MEMBER",
          message: "This person is already a member of the workspace.",
        },
        { status: 409 },
      );
    }

    console.error("Invitation creation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create the invitation.",
      },
      { status: 500 },
    );
  }
}
