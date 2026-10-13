import { sendPasswordResetEmail, type SendEmailResult } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  generateHashedToken,
  hashToken,
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
} from "@/lib/token";
import { lockUser } from "@/services/user-lock";

type IssueResult =
  | { status: "issued"; email: string; token: string }
  | { status: "not-found" };

// Replaces any earlier reset tokens, so only the newest link works.
async function issuePasswordResetToken(email: string): Promise<IssueResult> {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return { status: "not-found" };
  }

  return prisma.$transaction(async (tx) => {
    const locked = await lockUser(tx, user.id);

    if (!locked || locked.email !== email) {
      return { status: "not-found" };
    }

    await tx.authToken.deleteMany({
      where: {
        userId: user.id,
        purpose: "PASSWORD_RESET",
      },
    });

    const { token, tokenHash } = generateHashedToken();

    await tx.authToken.create({
      data: {
        userId: user.id,
        purpose: "PASSWORD_RESET",
        tokenHash,
        email: locked.email,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_LIFETIME_MS),
      },
    });

    return { status: "issued", email: locked.email, token };
  });
}

export type PasswordResetRequestResult =
  | { status: "sent" }
  | { status: "not-found" }
  | {
      status: "failed";
      error: Extract<SendEmailResult, { ok: false }>["error"];
    };

export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResult> {
  const issued = await issuePasswordResetToken(email);

  if (issued.status === "not-found") {
    return issued;
  }

  // Sent after the transaction commits so the row lock isn't held during a
  // network call.
  const delivery = await sendPasswordResetEmail(issued.email, issued.token);

  if (!delivery.ok) {
    return { status: "failed", error: delivery.error };
  }

  return { status: "sent" };
}

// Returns false for unknown, expired, already used, or stale tokens alike, so
// a caller learns nothing about which one it was.
export async function resetPassword(token: string, password: string) {
  const tokenHash = hashToken(token);

  // A cheap lookup first, so a bad token never costs a bcrypt hash. Every
  // check is repeated under the user lock below.
  const candidate = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      purpose: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
    },
  });

  if (!candidate) {
    return false;
  }

  // Hashed before the transaction so the row lock isn't held for the
  // deliberately slow bcrypt work.
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        userId: true,
        email: true,
        purpose: true,
      },
    });

    if (!record || record.purpose !== "PASSWORD_RESET") {
      return false;
    }

    const user = await lockUser(tx, record.userId);
    const now = new Date();

    // Concurrent requests are serialized by the user lock, so exactly one of
    // them can mark the token used.
    const { count } = await tx.authToken.updateMany({
      where: {
        tokenHash,
        purpose: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    // A token sent to an earlier address must not take over the account.
    if (count === 0 || !user || user.email !== record.email) {
      return false;
    }

    // Receiving the link at the account's current address also proves the
    // user owns it.
    await tx.user.update({
      where: {
        id: record.userId,
      },
      data: {
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt ?? now,
      },
    });

    // Anyone signed in with the old password is signed out.
    await tx.session.deleteMany({
      where: {
        userId: record.userId,
      },
    });

    await tx.authToken.deleteMany({
      where: {
        userId: record.userId,
        purpose: "PASSWORD_RESET",
        usedAt: null,
      },
    });

    return true;
  });
}
