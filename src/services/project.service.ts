import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pickAvailableSlug, slugify } from "@/lib/slug";
import type { CreateProjectInput } from "@/lib/validations/project";

const MAX_CREATE_ATTEMPTS = 3;

async function findAvailableSlug(workspaceId: string, baseSlug: string) {
  const existing = await prisma.project.findMany({
    where: {
      workspaceId,
      slug: {
        startsWith: baseSlug,
      },
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

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
) {
  const baseSlug = slugify(input.name, "project");

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    const slug = await findAvailableSlug(workspaceId, baseSlug);

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
      // Same race as workspace creation, scoped to slugs within one workspace.
      const isSlugTaken =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("workspaceId") &&
        error.meta.target.includes("slug");

      if (!isSlugTaken || attempt === MAX_CREATE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Unable to create project.");
}

export async function getWorkspaceProjects(workspaceId: string) {
  return prisma.project.findMany({
    where: {
      workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
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
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
}
