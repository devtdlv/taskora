import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Keeps these advisory locks apart from any others the database might use.
const PROJECT_LOCK_NAMESPACE = 7301;
const TASK_ORDER_LOCK_NAMESPACE = 7302;

type LockMode = "shared" | "exclusive";

// Finds a project through its workspace and the user's membership and holds a
// transaction-level advisory lock on it. Returns null when the project is
// missing or the user can't access it.
//
// Task and comment writes take the lock shared, so they don't block each
// other. Archiving, restoring, and editing take it exclusively, so they wait
// for writes in progress to commit, and writes that arrive later wait for
// them. A row lock can't be used here: new share lockers skip ahead of a
// waiting UPDATE, so steady writes could hold off an archive indefinitely.
// Advisory locks queue fairly.
//
// The project is read again once the lock is held, so an archive or rename
// committed while waiting is visible: no write lands after an archive.
export async function lockProject(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  mode: LockMode,
) {
  const [found] = await tx.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "projects" p
    JOIN "workspaces" w ON w."id" = p."workspaceId"
    WHERE w."slug" = ${workspaceSlug}
      AND p."slug" = ${projectSlug}
      AND EXISTS (
        SELECT 1 FROM "workspace_members" m
        WHERE m."workspaceId" = w."id" AND m."userId" = ${userId}
      )
  `;

  if (!found) {
    return null;
  }

  if (mode === "shared") {
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock_shared(${PROJECT_LOCK_NAMESPACE}::int, hashtext(${found.id}))
    `;
  } else {
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock(${PROJECT_LOCK_NAMESPACE}::int, hashtext(${found.id}))
    `;
  }

  const [project] = await tx.$queryRaw<
    { id: string; workspaceId: string; archivedAt: Date | null }[]
  >`
    SELECT "id", "workspaceId", "archivedAt"
    FROM "projects"
    WHERE "id" = ${found.id} AND "slug" = ${projectSlug}
  `;

  return project ?? null;
}

// Writes that read and rewrite task positions take this lock, so two of them
// in one project can't both read the same column and save conflicting
// orders. It's only taken inside writeToActiveProject, after the shared
// project lock, so the two locks are always taken in the same order.
export async function lockTaskOrder(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  await tx.$queryRaw`
    SELECT 1 FROM pg_advisory_xact_lock(${TASK_ORDER_LOCK_NAMESPACE}::int, hashtext(${projectId}))
  `;
}

export type ProjectWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "NOT_FOUND" | "PROJECT_ARCHIVED" };

// Runs a task or comment write only while the project is active.
export async function writeToActiveProject<T>(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  write: (
    tx: Prisma.TransactionClient,
    project: { id: string; workspaceId: string },
  ) => Promise<T>,
): Promise<ProjectWriteResult<T>> {
  return prisma.$transaction(async (tx): Promise<ProjectWriteResult<T>> => {
    const project = await lockProject(
      tx,
      userId,
      workspaceSlug,
      projectSlug,
      "shared",
    );

    if (!project) {
      return { ok: false, error: "NOT_FOUND" };
    }

    if (project.archivedAt) {
      return { ok: false, error: "PROJECT_ARCHIVED" };
    }

    return { ok: true, value: await write(tx, project) };
  });
}
