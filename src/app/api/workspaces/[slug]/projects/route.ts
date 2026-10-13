import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { createProjectSchema } from "@/lib/validations/project";
import { createProject } from "@/services/project.service";
import { getWorkspaceMembership } from "@/services/workspace.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const auth = await requireVerifiedApiUser(
      "You need to log in to create a project.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;

    const { slug } = await params;
    const membership = await getWorkspaceMembership(user.id, slug);

    if (!membership) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Workspace not found.",
        },
        { status: 404 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = createProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const project = await createProject(membership.workspace.id, result.data);

    return NextResponse.json(
      {
        project,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Project creation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create your project.",
      },
      { status: 500 },
    );
  }
}
