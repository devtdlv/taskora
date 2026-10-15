import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { ChangePasswordInput } from "@/lib/validations/auth";
import { lockUser } from "@/services/user-lock";

// Every write here is matched by the signed-in user's ID, so one account can
// never change another's.

export async function updateDisplayName(userId: string, name: string) {
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { name },
  });

  return count > 0 ? { name } : null;
}

type ChangePasswordResult =
  | { ok: true; signedOutSessions: number }
  | { ok: false; error: "INVALID_CURRENT_PASSWORD" };

// The current password is checked, and the new one hashed, before the
// transaction, so the row lock isn't held during the deliberately slow bcrypt
// work. The update then only applies if the stored hash is still the one that
// was checked: if a concurrent change or reset replaced it first, the current
// password the user gave is no longer current, and nothing is written.
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: Pick<ChangePasswordInput, "currentPassword" | "newPassword">,
): Promise<ChangePasswordResult> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
    return { ok: false, error: "INVALID_CURRENT_PASSWORD" };
  }

  const passwordHash = await hashPassword(input.newPassword);

  return prisma.$transaction(async (tx): Promise<ChangePasswordResult> => {
    // Taken before touching reset tokens, like every other token flow.
    await lockUser(tx, userId);

    const { count } = await tx.user.updateMany({
      where: { id: userId, passwordHash: account.passwordHash },
      data: { passwordHash },
    });

    if (count === 0) {
      return { ok: false, error: "INVALID_CURRENT_PASSWORD" };
    }

    // Anyone signed in elsewhere with the old password is signed out, and a
    // reset link requested earlier can't undo the change.
    const signedOut = await tx.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });

    await tx.authToken.deleteMany({
      where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
    });

    return { ok: true, signedOutSessions: signedOut.count };
  });
}

// Signing out twice is harmless: the second call just finds nothing to delete.
export async function signOutOtherSessions(userId: string, currentSessionId: string) {
  const { count } = await prisma.session.deleteMany({
    where: { userId, id: { not: currentSessionId } },
  });

  return count;
}
