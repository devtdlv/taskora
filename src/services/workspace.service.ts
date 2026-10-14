import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pickAvailableSlug, slugify } from "@/lib/slug";
import type { CreateWorkspaceInput } from "@/lib/validations/workspace";
import { lockWorkspaceMembership } from "@/services/workspace-lock";

const MAX_CREATE_ATTEMPTS = 3;

async function findAvailableSlug(baseSlug: string) {
  const existing = await prisma.workspace.findMany({
    where: {
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
    existing.map((workspace) => workspace.slug),
  );
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
) {
  const baseSlug = slugify(input.name, "workspace");

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    const slug = await findAvailableSlug(baseSlug);

    try {
      return await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: input.name,
            slug,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: workspace.id,
            role: "OWNER",
          },
        });

        return workspace;
      });
    } catch (error) {
      // Two requests can pick the same free slug at once. The unique
      // constraint rejects the second one, so look up a new slug and retry.
      const isSlugTaken =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("slug");

      if (!isSlugTaken || attempt === MAX_CREATE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Unable to create workspace.");
}

export async function getUserWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: {
              projects: true,
              members: true,
            },
          },
        },
      },
    },
  });
}

export async function getWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      role: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

type MemberChangeResult<E extends string> = { ok: true } | { ok: false; error: E };

function countOwners(tx: Prisma.TransactionClient, workspaceId: string) {
  return tx.workspaceMember.count({
    where: {
      workspaceId,
      role: "OWNER",
    },
  });
}

// Owners remove other people; removing yourself goes through leaveWorkspace.
// Deleting the membership row is all it takes to revoke access, because every
// page and route checks membership on each request. The user's account and
// comments are kept, and tasks assigned to them become unassigned.
export async function removeWorkspaceMember(
  userId: string,
  workspaceSlug: string,
  memberId: string,
) {
  return prisma.$transaction(
    async (
      tx,
    ): Promise<
      MemberChangeResult<
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "MEMBER_NOT_FOUND"
        | "CANNOT_REMOVE_SELF"
        | "LAST_OWNER"
      >
    > => {
      const actor = await lockWorkspaceMembership(tx, userId, workspaceSlug);

      if (!actor) {
        return { ok: false, error: "NOT_FOUND" };
      }

      if (actor.role !== "OWNER") {
        return { ok: false, error: "FORBIDDEN" };
      }

      if (actor.id === memberId) {
        return { ok: false, error: "CANNOT_REMOVE_SELF" };
      }

      const target = await tx.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId: actor.workspaceId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!target) {
        return { ok: false, error: "MEMBER_NOT_FOUND" };
      }

      if (
        target.role === "OWNER" &&
        (await countOwners(tx, actor.workspaceId)) <= 1
      ) {
        return { ok: false, error: "LAST_OWNER" };
      }

      await tx.workspaceMember.delete({
        where: {
          id: target.id,
        },
      });

      return { ok: true };
    },
  );
}

export async function leaveWorkspace(userId: string, workspaceSlug: string) {
  return prisma.$transaction(
    async (tx): Promise<MemberChangeResult<"NOT_FOUND" | "LAST_OWNER">> => {
      const membership = await lockWorkspaceMembership(
        tx,
        userId,
        workspaceSlug,
      );

      if (!membership) {
        return { ok: false, error: "NOT_FOUND" };
      }

      if (
        membership.role === "OWNER" &&
        (await countOwners(tx, membership.workspaceId)) <= 1
      ) {
        return { ok: false, error: "LAST_OWNER" };
      }

      await tx.workspaceMember.delete({
        where: {
          id: membership.id,
        },
      });

      return { ok: true };
    },
  );
}

// Returns null both when the workspace doesn't exist and when the user isn't
// a member, so callers can't reveal which workspaces exist. Cached per request
// because the workspace layout and its pages both check membership.
export const getWorkspaceMembership = cache(
  async (userId: string, slug: string) => {
    return prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: {
          slug,
        },
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  },
);
