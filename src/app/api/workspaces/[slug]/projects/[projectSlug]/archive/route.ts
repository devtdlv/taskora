import { NextResponse } from "next/server";

import { requireVerifiedApiUser } from "@/lib/auth-guard";
import { rejectUntrustedMutation } from "@/lib/request";
import { setProjectArchived } from "@/services/project.service";

type ArchiveRouteContext = {
  params: Promise<{ slug: string; projectSlug: string }>;
};

function projectNotFoundResponse() {
  return NextResponse.json(
    {
      error: "NOT_FOUND",
      message: "Project not found.",
    },
    { status: 404 },
  );
}

// POST archives the project and DELETE restores it. Both succeed when the
// project is already in the requested state.
export async function POST(request: Request, { params }: ArchiveRouteContext) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to archive a project.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;
    const { slug, projectSlug } = await params;

    if (!(await setProjectArchived(user.id, slug, projectSlug, true))) {
      return projectNotFoundResponse();
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Project archive failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to archive the project.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: ArchiveRouteContext) {
  try {
    const rejected = rejectUntrustedMutation(request, { jsonBody: false });

    if (rejected) {
      return rejected;
    }

    const auth = await requireVerifiedApiUser(
      "You need to log in to restore a project.",
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { user } = auth;
    const { slug, projectSlug } = await params;

    if (!(await setProjectArchived(user.id, slug, projectSlug, false))) {
      return projectNotFoundResponse();
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Project restore failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to restore the project.",
      },
      { status: 500 },
    );
  }
}
