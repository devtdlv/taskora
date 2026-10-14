import type { Prisma } from "@/generated/prisma/client";

// Removing members, leaving, and revoking invitations lock the workspace row
// first, so those changes run one at a time per workspace. That's what makes a
// last-owner check and the delete after it a single step: two owners leaving
// at once can't both see the other one still there. NO KEY UPDATE doesn't
// conflict with the key-share lock that inserts referencing the workspace
// take, so accepting invitations and creating projects aren't blocked.
//
// The membership is read in a separate statement after the lock is held, so
// a change committed by whichever request held the lock before is visible.
// Returns null when the workspace doesn't exist or the user isn't a member.
export async function lockWorkspaceMembership(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceSlug: string,
) {
  const [workspace] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "workspaces"
    WHERE "slug" = ${workspaceSlug}
    FOR NO KEY UPDATE
  `;

  if (!workspace) {
    return null;
  }

  return tx.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: workspace.id,
      },
    },
    select: {
      id: true,
      role: true,
      workspaceId: true,
    },
  });
}
