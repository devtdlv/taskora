import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
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

export async function PATCH(request: Request, { params }: TaskRouteContext) {
  try {
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
    const task = await updateTaskStatus(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data.status,
    );

    if (!task) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ task });
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
    const task = await updateTask(
      user.id,
      slug,
      projectSlug,
      taskId,
      result.data,
    );

    if (!task) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ task });
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

export async function DELETE(_request: Request, { params }: TaskRouteContext) {
  try {
    const auth = await requireVerifiedApiUser(
      "You need to log in to delete a task.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { slug, projectSlug, taskId } = await params;
    const deleted = await deleteTask(user.id, slug, projectSlug, taskId);

    if (!deleted) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Task not found.",
        },
        { status: 404 },
      );
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
