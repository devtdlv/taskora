import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  projectArchivedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { updateTaskAssigneeSchema } from "@/lib/validations/task";
import { updateTaskAssignee } from "@/services/task.service";

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ slug: string; projectSlug: string; taskId: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to update a task.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = updateTaskAssigneeSchema.safeParse(body);

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
    const update = await updateTaskAssignee(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data.assigneeId,
    );

    if (!update.ok && update.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!update.ok && update.error === "NOT_FOUND") {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
    }

    if (!update.ok) {
      return NextResponse.json(
        {
          error: "INVALID_ASSIGNEE",
          message: "That person isn't a member of this workspace.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ task: update.task });
  } catch (error) {
    console.error("Task assignee update failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update the task.",
      },
      { status: 500 },
    );
  }
}
