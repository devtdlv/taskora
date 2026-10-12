import { sendVerificationEmail, type SendEmailResult } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
  generateHashedToken,
  hashToken,
} from "@/lib/token";
import { lockUser } from "@/services/user-lock";

type IssueResult =
  | { status: "issued"; email: string; token: string }
  | { status: "already-verified" }
  | { status: "not-found" };

// Replaces any earlier verification tokens, so only the newest link works.
async function issueVerificationToken(userId: string): Promise<IssueResult> {
  return prisma.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);

    if (!user) {
      return { status: "not-found" };
    }

    if (user.emailVerifiedAt) {
      return { status: "already-verified" };
    }

    await tx.authToken.deleteMany({
      where: {
        userId,
        purpose: "EMAIL_VERIFICATION",
      },
    });

    const { token, tokenHash } = generateHashedToken();

    await tx.authToken.create({
      data: {
        userId,
        purpose: "EMAIL_VERIFICATION",
        tokenHash,
        email: user.email,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_LIFETIME_MS),
      },
    });

    return { status: "issued", email: user.email, token };
  });
}

export type EmailVerificationResult =
  | { status: "sent" }
  | { status: "already-verified" }
  | {
      status: "failed";
      error: "USER_NOT_FOUND" | Extract<SendEmailResult, { ok: false }>["error"];
    };

export async function sendEmailVerification(
  userId: string,
): Promise<EmailVerificationResult> {
  const issued = await issueVerificationToken(userId);

  if (issued.status === "not-found") {
    return { status: "failed", error: "USER_NOT_FOUND" };
  }

  if (issued.status === "already-verified") {
    return issued;
  }

  // Sent after the transaction commits so the row lock isn't held during a
  // network call.
  const delivery = await sendVerificationEmail(issued.email, issued.token);

  if (!delivery.ok) {
    return { status: "failed", error: delivery.error };
  }

  return { status: "sent" };
}

// Returns false for unknown, expired, already used, or stale tokens alike, so
// a caller learns nothing about which one it was.
export async function confirmEmailVerification(token: string) {
  const tokenHash = hashToken(token);

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

    if (!record || record.purpose !== "EMAIL_VERIFICATION") {
      return false;
    }

    const user = await lockUser(tx, record.userId);
    const now = new Date();

    // Only succeeds while the token is unused and unexpired. Concurrent
    // requests are already serialized by the user lock, so exactly one of
    // them can mark it used.
    const { count } = await tx.authToken.updateMany({
      where: {
        tokenHash,
        purpose: "EMAIL_VERIFICATION",
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    // A token only proves ownership of the address it was sent to.
    if (count === 0 || !user || user.email !== record.email) {
      return false;
    }

    if (!user.emailVerifiedAt) {
      await tx.user.update({
        where: {
          id: record.userId,
        },
        data: {
          emailVerifiedAt: now,
        },
      });
    }

    await tx.authToken.deleteMany({
      where: {
        userId: record.userId,
        purpose: "EMAIL_VERIFICATION",
        usedAt: null,
      },
    });

    return true;
  });
}
