import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  projectArchivedResponse,
  rejectUntrustedMutation,
} from "@/lib/request";
import { deleteTaskComment } from "@/services/comment.service";

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      slug: string;
      projectSlug: string;
      taskId: string;
      commentId: string;
    }>;
  },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to delete a comment.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { slug, projectSlug, taskId, commentId } = await params;
    const deleted = await deleteTaskComment(
      user.id,
      slug,
      projectSlug,
      taskId,
      commentId,
    );

    if (!deleted.ok && deleted.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!deleted.ok || !deleted.value) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Comment not found.",
        },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Comment deletion failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to delete the comment.",
      },
      { status: 500 },
    );
  }
}
