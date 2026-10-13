import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { createCommentSchema } from "@/lib/validations/comment";
import { createTaskComment } from "@/services/comment.service";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ slug: string; projectSlug: string; taskId: string }> },
) {
  try {
    const auth = await requireVerifiedApiUser("You need to log in to comment.");

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = createCommentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { slug, projectSlug, taskId } = await params;
    const comment = await createTaskComment(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data.body,
    );

    if (!comment) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        comment,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Comment creation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to post your comment.",
      },
      { status: 500 },
    );
  }
}
