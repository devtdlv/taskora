import type { Prisma } from "@/generated/prisma/client";

type LockedUser = {
  email: string;
  emailVerifiedAt: Date | null;
};

// Every flow that issues or consumes an auth token locks the user row before
// touching tokens. That serializes concurrent requests for the same account
// and keeps the lock order the same everywhere, so no two flows can deadlock.
export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  const [user] = await tx.$queryRaw<LockedUser[]>`
    SELECT "email", "emailVerifiedAt"
    FROM "users"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  return user ?? null;
}
