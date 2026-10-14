import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import {
  invalidJsonResponse,
  projectArchivedResponse,
  readJsonBody,
  rejectUntrustedMutation,
} from "@/lib/request";
import { updateProjectSchema } from "@/lib/validations/project";
import { updateProject } from "@/services/project.service";

// Updates the project's name and description. The response includes the slug,
// which changes when the new name produces a different one.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; projectSlug: string }> },
) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: true });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to edit a project.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = updateProjectSchema.safeParse(body);

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
    const update = await updateProject(user.id, slug, projectSlug, result.data);

    if (!update.ok && update.error === "PROJECT_ARCHIVED") {
      return projectArchivedResponse();
    }

    if (!update.ok) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ project: update.project });
  } catch (error) {
    console.error("Project update failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update the project.",
      },
      { status: 500 },
    );
  }
}
