// Imported first by every database test, before any app module, so the app's
// Prisma client connects to the test database.

import { randomUUID } from "node:crypto";

import { getTestDatabaseUrl } from "./test-database.mjs";

process.env.DATABASE_URL = getTestDatabaseUrl();
delete process.env.DIRECT_URL;
process.env.ENFORCE_EMAIL_VERIFICATION = "false";

const { prisma } = await import("@/lib/prisma");

export { prisma };

// Unique per call, so test files never collide on emails or slugs.
export function uniqueName(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// Faster than signing up: these users never log in, so the hash is a dummy.
export async function createTestUser(tag, { verified = true } = {}) {
  return prisma.user.create({
    data: {
      name: `Test ${tag}`,
      email: `${uniqueName(tag)}@example.invalid`,
      passwordHash: "not-a-real-hash",
      emailVerifiedAt: verified ? new Date() : null,
    },
    select: { id: true, email: true },
  });
}

export async function disconnect() {
  await prisma.$disconnect();
}
