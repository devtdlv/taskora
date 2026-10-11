import { NextResponse } from "next/server";

import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { createTaskSchema } from "@/lib/validations/task";
import { getWorkspaceProject } from "@/services/project.service";
import { createTask } from "@/services/task.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; projectSlug: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "You need to log in to create a task.",
        },
        { status: 401 },
      );
    }

    const { slug, projectSlug } = await params;
    const project = await getWorkspaceProject(user.id, slug, projectSlug);

    if (!project) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = createTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const task = await createTask(project.id, result.data);

    return NextResponse.json(
      {
        task,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Task creation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create your task.",
      },
      { status: 500 },
    );
  }
}
