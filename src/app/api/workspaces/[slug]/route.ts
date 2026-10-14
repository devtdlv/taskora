import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { renameWorkspaceSchema } from "@/lib/validations/workspace";
import { renameWorkspace } from "@/services/workspace.service";

const ERROR_RESPONSES = {
  NOT_FOUND: {
    status: 404,
    message: "Workspace not found.",
  },
  FORBIDDEN: {
    status: 403,
    message: "Only a workspace owner can rename the workspace.",
  },
};

// Renames the workspace. The response includes the slug, which changes when
// the new name produces a different one, so the client can follow it.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to rename a workspace.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = renameWorkspaceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { slug } = await params;
    const rename = await renameWorkspace(user.id, slug, result.data);

    if (!rename.ok) {
      const { status, message } = ERROR_RESPONSES[rename.error];

      return NextResponse.json({ error: rename.error, message }, { status });
    }

    return NextResponse.json({ workspace: rename.workspace });
  } catch (error) {
    console.error("Workspace rename failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to rename the workspace.",
      },
      { status: 500 },
    );
  }
}
