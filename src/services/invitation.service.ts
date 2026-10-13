import { createHash, randomBytes } from "node:crypto";

import { needsEmailVerification } from "@/lib/email-verification-policy";
import { prisma } from "@/lib/prisma";
import { lockUser } from "@/services/user-lock";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Invitation tokens work like passwords for joining a workspace, so only a
// hash is stored. The raw token exists only in the link given to the owner.
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// There is one invitation row per email per workspace. Inviting the same email
// again replaces the token and expiry, which also invalidates the old link.
export async function createWorkspaceInvitation(
  workspaceId: string,
  email: string,
) {
  const existingMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: {
        email,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingMember) {
    throw new Error("ALREADY_MEMBER");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  await prisma.workspaceInvitation.upsert({
    where: {
      workspaceId_email: {
        workspaceId,
        email,
      },
    },
    create: {
      workspaceId,
      email,
      tokenHash,
      expiresAt,
    },
    update: {
      tokenHash,
      expiresAt,
      acceptedAt: null,
    },
  });

  return { token, email, expiresAt };
}

export async function getInvitationByToken(token: string) {
  return prisma.workspaceInvitation.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

type AcceptInvitationResult =
  | { ok: true; workspaceSlug: string }
  | {
      ok: false;
      error:
        | "INVALID_INVITATION"
        | "EMAIL_MISMATCH"
        | "INVITATION_EXPIRED"
        | "INVITATION_USED"
        | "EMAIL_NOT_VERIFIED";
    };

export async function acceptWorkspaceInvitation(
  user: { id: string; email: string },
  token: string,
): Promise<AcceptInvitationResult> {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return { ok: false, error: "INVALID_INVITATION" };
  }

  // Checked before anything else so someone holding another person's link
  // learns nothing about whether it's expired or used.
  if (invitation.email !== user.email) {
    return { ok: false, error: "EMAIL_MISMATCH" };
  }

  if (!invitation.acceptedAt && invitation.expiresAt <= new Date()) {
    return { ok: false, error: "INVITATION_EXPIRED" };
  }

  const workspaceId = invitation.workspace.id;

  // The conditional update only succeeds while the invitation is still
  // pending, and Postgres locks the row, so concurrent requests can't both
  // accept it. Membership is created in the same transaction, so neither
  // change can exist without the other.
  const outcome = await prisma.$transaction(async (tx) => {
    // The account is read here rather than trusted from the caller, so no
    // caller can skip verification or pass a stale email.
    const account = await lockUser(tx, user.id);

    if (!account || account.email !== invitation.email) {
      return "mismatch";
    }

    if (needsEmailVerification(account)) {
      return "unverified";
    }

    const { count } = await tx.workspaceInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        acceptedAt: new Date(),
      },
    });

    if (count === 0) {
      return "not-pending";
    }

    await tx.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      create: {
        userId: user.id,
        workspaceId,
        role: "MEMBER",
      },
      update: {},
    });

    return "accepted";
  });

  if (outcome === "mismatch") {
    return { ok: false, error: "EMAIL_MISMATCH" };
  }

  if (outcome === "unverified") {
    return { ok: false, error: "EMAIL_NOT_VERIFIED" };
  }

  if (outcome === "not-pending") {
    // Already accepted, possibly by this user on an earlier or concurrent
    // request. That's only a success if they ended up as a member.
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      return { ok: false, error: "INVITATION_USED" };
    }
  }

  return { ok: true, workspaceSlug: invitation.workspace.slug };
}
