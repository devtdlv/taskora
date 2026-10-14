import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  projectArchivedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { createTaskSchema } from "@/lib/validations/task";
import { createTask } from "@/services/task.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; projectSlug: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to create a task.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

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

    const { slug, projectSlug } = await params;
    const created = await createTask(user.id, slug, projectSlug, result.data);

    if (!created.ok && created.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!created.ok) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        task: created.value,
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
