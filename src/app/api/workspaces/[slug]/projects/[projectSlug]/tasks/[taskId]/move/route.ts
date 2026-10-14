import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  projectArchivedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { moveTaskSchema } from "@/lib/validations/task";
import { moveTask } from "@/services/task.service";

export async function POST(
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
      "You need to log in to move a task.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = moveTaskSchema.safeParse(body);

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
    const moved = await moveTask(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data.status,
      result.data.index,
    );

    if (!moved.ok && moved.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!moved.ok || !moved.value) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ task: moved.value });
  } catch (error) {
    console.error("Task move failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to move the task.",
      },
      { status: 500 },
    );
  }
}
