import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "@/lib/validations/task";
import { lockTaskOrder, writeToActiveProject } from "@/services/project-lock";

// Positions can have gaps, for example after a delete, so the order is what
// counts, not the numbers. The tie-breakers keep it deterministic regardless.
const COLUMN_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { position: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
];

// New tasks go to the end of the To do column.
export async function createTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  input: CreateTaskInput,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      await lockTaskOrder(tx, project.id);

      const last = await tx.task.aggregate({
        where: { projectId: project.id, status: "TODO" },
        _max: { position: true },
      });

      return tx.task.create({
        data: {
          projectId: project.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          position: (last._max.position ?? -1) + 1,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          position: true,
        },
      });
    },
  );
}

export async function getProjectTasks(projectId: string) {
  return prisma.task.findMany({
    where: {
      projectId,
    },
    orderBy: COLUMN_ORDER,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignee: {
        select: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

// Both counts only reach tasks through the user's own memberships, so tasks in
// other workspaces are never included. Archived projects aren't active work,
// so their tasks are left out.
export async function getOpenTaskCounts(userId: string) {
  const openTasks: Prisma.TaskWhereInput = {
    status: {
      not: "DONE",
    },
    project: {
      archivedAt: null,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
  };

  const [open, assignedToUser] = await Promise.all([
    prisma.task.count({
      where: openTasks,
    }),
    prisma.task.count({
      where: {
        ...openTasks,
        assignee: {
          userId,
        },
      },
    }),
  ]);

  return { open, assignedToUser };
}

// Like getWorkspaceProject, the task is only matched through its project,
// workspace, and the user's membership, so a known task ID alone is never
// enough to read it. Missing and inaccessible tasks both return null. Cached
// per request because the task layout and its page both look the task up.
export const getProjectTask = cache(
  async (
    userId: string,
    workspaceSlug: string,
    projectSlug: string,
    taskId: string,
  ) => {
    return prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
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
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
        project: {
          select: {
            name: true,
            slug: true,
            archivedAt: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  },
);

// The task writes below run through writeToActiveProject, which has already
// matched the project through the user's membership and confirmed it isn't
// archived. Each write is then limited to that project, so a task ID from
// another project matches nothing. A null or false value means the task is
// missing or already gone.
async function columnTaskIds(
  tx: Prisma.TransactionClient,
  projectId: string,
  status: TaskStatus,
) {
  const tasks = await tx.task.findMany({
    where: { projectId, status },
    orderBy: COLUMN_ORDER,
    select: { id: true },
  });

  return tasks.map((task) => task.id);
}

// Saves a column's order as positions 0, 1, 2, and so on. Only rows in this
// project are matched, and rows already in place aren't rewritten.
async function saveColumnOrder(
  tx: Prisma.TransactionClient,
  projectId: string,
  taskIds: string[],
) {
  if (taskIds.length === 0) {
    return;
  }

  await tx.$executeRaw`
    UPDATE "tasks" t
    SET "position" = ordered.ord - 1
    FROM unnest(${taskIds}::text[]) WITH ORDINALITY AS ordered(id, ord)
    WHERE t."id" = ordered.id
      AND t."projectId" = ${projectId}
      AND t."position" <> ordered.ord - 1
  `;
}

// Puts a task at an index in a status column, or at the end when the index is
// null, and renumbers the columns it left and joined. The order lock is held
// from the first read to the last write, so moves, status changes, and new
// tasks in the same project are applied one at a time against the current
// order, never a stale one.
async function placeTask(
  tx: Prisma.TransactionClient,
  projectId: string,
  taskId: string,
  status: TaskStatus,
  index: number | null,
) {
  await lockTaskOrder(tx, projectId);

  const task = await tx.task.findFirst({
    where: { id: taskId, projectId },
    select: { status: true },
  });

  if (!task) {
    return null;
  }

  const target = (await columnTaskIds(tx, projectId, status)).filter(
    (id) => id !== taskId,
  );
  const position =
    index === null ? target.length : Math.min(index, target.length);

  target.splice(position, 0, taskId);

  if (task.status !== status) {
    await tx.task.updateMany({
      where: { id: taskId, projectId },
      data: { status },
    });

    await saveColumnOrder(
      tx,
      projectId,
      await columnTaskIds(tx, projectId, task.status),
    );
  }

  await saveColumnOrder(tx, projectId, target);

  return { id: taskId, status, position };
}

// A status change from the status select moves the task to the end of its new
// column. Choosing the status it already has leaves it where it is.
export async function updateTaskStatus(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  status: TaskStatus,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, projectId: project.id },
        select: { status: true },
      });

      if (task?.status === status) {
        return { id: taskId, status };
      }

      const placed = await placeTask(tx, project.id, taskId, status, null);

      return placed && { id: placed.id, status: placed.status };
    },
  );
}

// Drag and drop: moves a task within its column or into another one.
export async function moveTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  status: TaskStatus,
  index: number,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    (tx, project) => placeTask(tx, project.id, taskId, status, index),
  );
}

// Only title, description, priority, and due date are written, so status and
// assignee are left as they are. An undefined priority leaves it unchanged.
export async function updateTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      const result = await tx.task.updateMany({
        where: {
          id: taskId,
          projectId: project.id,
        },
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
        },
      });

      return result.count > 0 ? { id: taskId } : null;
    },
  );
}

// Repeated delete requests are harmless: the second one just matches nothing.
export async function deleteTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      await lockTaskOrder(tx, project.id);

      const task = await tx.task.findFirst({
        where: { id: taskId, projectId: project.id },
        select: { status: true },
      });

      if (!task) {
        return false;
      }

      await tx.task.deleteMany({
        where: {
          id: taskId,
          projectId: project.id,
        },
      });

      await saveColumnOrder(
        tx,
        project.id,
        await columnTaskIds(tx, project.id, task.status),
      );

      return true;
    },
  );
}

type UpdateTaskAssigneeResult =
  | { ok: true; task: { id: string; assigneeId: string | null } }
  | { ok: false; error: "NOT_FOUND" | "INVALID_ASSIGNEE" | "PROJECT_ARCHIVED" };

export async function updateTaskAssignee(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  assigneeId: string | null,
): Promise<UpdateTaskAssigneeResult> {
  const result = await writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project): Promise<UpdateTaskAssigneeResult> => {
      // The assignee must be a member of the task's own workspace. Checking it
      // in the update's WHERE clause makes the membership check and the write
      // a single statement, so there's no gap between checking and writing.
      const updated = await tx.task.updateMany({
        where: {
          id: taskId,
          projectId: project.id,
          ...(assigneeId && {
            project: {
              workspace: {
                members: {
                  some: {
                    id: assigneeId,
                  },
                },
              },
            },
          }),
        },
        data: {
          assigneeId,
        },
      });

      if (updated.count > 0) {
        return { ok: true, task: { id: taskId, assigneeId } };
      }

      // Nothing matched, so work out which response to give. This read only
      // picks the error; it doesn't authorize anything.
      const task = assigneeId
        ? await tx.task.findFirst({
            where: { id: taskId, projectId: project.id },
            select: { id: true },
          })
        : null;

      return { ok: false, error: task ? "INVALID_ASSIGNEE" : "NOT_FOUND" };
    },
  );

  return result.ok ? result.value : result;
}
