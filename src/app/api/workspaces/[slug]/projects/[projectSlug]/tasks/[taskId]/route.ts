import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  projectArchivedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import {
  updateTaskSchema,
  updateTaskStatusSchema,
} from "@/lib/validations/task";
import {
  deleteTask,
  updateTask,
  updateTaskStatus,
} from "@/services/task.service";

type TaskRouteContext = {
  params: Promise<{ slug: string; projectSlug: string; taskId: string }>;
};

function taskNotFoundResponse() {
  return NextResponse.json(
    {
      error: "NOT_FOUND",
      message: "Task not found.",
    },
    { status: 404 },
  );
}

export async function PATCH(request: Request, { params }: TaskRouteContext) {
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

    const result = updateTaskStatusSchema.safeParse(body);

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
    const update = await updateTaskStatus(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data.status,
    );

    if (!update.ok && update.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!update.ok || !update.value) {
      return taskNotFoundResponse();
    }

    return NextResponse.json({ task: update.value });
  } catch (error) {
    console.error("Task status update failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update the task.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: TaskRouteContext) {
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

    const result = updateTaskSchema.safeParse(body);

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
    const update = await updateTask(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data,
    );

    if (!update.ok && update.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!update.ok || !update.value) {
      return taskNotFoundResponse();
    }

    return NextResponse.json({ task: update.value });
  } catch (error) {
    console.error("Task update failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update the task.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: TaskRouteContext) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to delete a task.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { slug, projectSlug, taskId } = await params;
    const deleted = await deleteTask(user.id, slug, projectSlug, taskId);

    if (!deleted.ok && deleted.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!deleted.ok || !deleted.value) {
      return taskNotFoundResponse();
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Task deletion failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to delete the task.",
      },
      { status: 500 },
    );
  }
}
