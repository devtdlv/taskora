import { NextResponse } from "next/server";

import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { updateTaskAssigneeSchema } from "@/lib/validations/task";
import { updateTaskAssignee } from "@/services/task.service";

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ slug: string; projectSlug: string; taskId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "You need to log in to update a task.",
        },
        { status: 401 },
      );
    }

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
