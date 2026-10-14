import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pickAvailableSlug, slugify, slugMatchesBase } from "@/lib/slug";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/validations/project";
import { lockProject } from "@/services/project-lock";

const MAX_SLUG_ATTEMPTS = 3;

async function findAvailableSlug(
  db: Prisma.TransactionClient,
  workspaceId: string,
  baseSlug: string,
  excludeProjectId?: string,
) {
  const existing = await db.project.findMany({
    where: {
      workspaceId,
      slug: {
        startsWith: baseSlug,
      },
      ...(excludeProjectId && { id: { not: excludeProjectId } }),
    },
    select: {
      slug: true,
    },
  });

  return pickAvailableSlug(
    baseSlug,
    existing.map((project) => project.slug),
  );
}

// Two requests can pick the same free slug at once. The unique constraint on
// (workspaceId, slug) rejects the second one, which then looks up a new slug.
function isProjectSlugTaken(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("workspaceId") &&
    error.meta.target.includes("slug")
  );
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
) {
  const baseSlug = slugify(input.name, "project");

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = await findAvailableSlug(prisma, workspaceId, baseSlug);

    try {
      return await prisma.project.create({
        data: {
          workspaceId,
          name: input.name,
          slug,
          description: input.description,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
    } catch (error) {
      if (!isProjectSlugTaken(error) || attempt === MAX_SLUG_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Unable to create project.");
}

type UpdateProjectResult =
  | { ok: true; project: { slug: string } }
  | { ok: false; error: "NOT_FOUND" | "PROJECT_ARCHIVED" };

// The slug follows the name, so links show what the project is called now. It
// only changes when the new name produces a different base slug, so fixing
// capitalization or editing the description keeps existing links working.
export async function updateProject(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  input: UpdateProjectInput,
) {
  const baseSlug = slugify(input.name, "project");

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx): Promise<UpdateProjectResult> => {
          const project = await lockProject(
            tx,
            userId,
            workspaceSlug,
            projectSlug,
            "exclusive",
          );

          if (!project) {
            return { ok: false, error: "NOT_FOUND" };
          }

          if (project.archivedAt) {
            return { ok: false, error: "PROJECT_ARCHIVED" };
          }

          const slug = slugMatchesBase(projectSlug, baseSlug)
            ? projectSlug
            : await findAvailableSlug(
                tx,
                project.workspaceId,
                baseSlug,
                project.id,
              );

          const updated = await tx.project.update({
            where: {
              id: project.id,
            },
            data: {
              name: input.name,
              description: input.description,
              slug,
            },
            select: {
              slug: true,
            },
          });

          return { ok: true, project: updated };
        },
      );
    } catch (error) {
      if (!isProjectSlugTaken(error) || attempt === MAX_SLUG_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Unable to update project.");
}

// The exclusive lock waits for task and comment writes in progress and holds
// off new ones until this commits (see lockProject). Archiving an archived
// project, or restoring an active one, changes nothing and still succeeds, so
// retries are harmless. Returns false when the project is missing or
// inaccessible.
export async function setProjectArchived(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  archived: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const project = await lockProject(
      tx,
      userId,
      workspaceSlug,
      projectSlug,
      "exclusive",
    );

    if (!project) {
      return false;
    }

    if ((project.archivedAt !== null) !== archived) {
      await tx.project.update({
        where: {
          id: project.id,
        },
        data: {
          archivedAt: archived ? new Date() : null,
        },
      });
    }

    return true;
  });
}

const projectListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  archivedAt: true,
  _count: {
    select: {
      tasks: true,
    },
  },
} satisfies Prisma.ProjectSelect;

export async function getWorkspaceProjects(workspaceId: string) {
  return prisma.project.findMany({
    where: {
      workspaceId,
      archivedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: projectListSelect,
  });
}

export async function getArchivedWorkspaceProjects(workspaceId: string) {
  return prisma.project.findMany({
    where: {
      workspaceId,
      archivedAt: {
        not: null,
      },
    },
    orderBy: {
      archivedAt: "desc",
    },
    select: projectListSelect,
  });
}

// The project is looked up through the workspace and the user's membership in
// one query, so a project can never be returned outside its workspace. Missing
// and inaccessible projects both return null.
export async function getWorkspaceProject(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
) {
  return prisma.project.findFirst({
    where: {
      slug: projectSlug,
      workspace: {
        slug: workspaceSlug,
        members: {
          some: {
            userId,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      archivedAt: true,
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
}
