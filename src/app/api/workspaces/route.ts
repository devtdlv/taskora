import { NextResponse } from "next/server";

import { invalidJsonResponse, readJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import { createWorkspaceSchema } from "@/lib/validations/workspace";
import { createWorkspace } from "@/services/workspace.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "You need to log in to create a workspace.",
        },
        { status: 401 },
      );
    }

    const body = await readJsonBody(request);

    if (body === undefined) {
      return invalidJsonResponse();
    }

    const result = createWorkspaceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const workspace = await createWorkspace(user.id, result.data);

    return NextResponse.json(
      {
        workspace,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Workspace creation failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create your workspace.",
      },
      { status: 500 },
    );
  }
}
