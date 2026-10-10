import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "@/lib/validations/task";

export async function createTask(projectId: string, input: CreateTaskInput) {
  return prisma.task.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });
}

export async function getProjectTasks(projectId: string) {
  return prisma.task.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      title: true,
      status: true,
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
// other workspaces are never included.
export async function getOpenTaskCounts(userId: string) {
  const openTasks: Prisma.TaskWhereInput = {
    status: {
      not: "DONE",
    },
    project: {
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
// enough to read it. Missing and inaccessible tasks both return null.
export async function getProjectTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
) {
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
      dueDate: true,
      assigneeId: true,
      project: {
        select: {
          name: true,
          slug: true,
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
}

// updateMany is used because it accepts the same relation filters as
// getProjectTask, so the update itself only matches tasks the user can access.
// A count of 0 means the task is missing or inaccessible.
export async function updateTaskStatus(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  status: TaskStatus,
) {
  const result = await prisma.task.updateMany({
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
    data: {
      status,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return { id: taskId, status };
}

// Same scoped updateMany approach as updateTaskStatus. Only title, description,
// and due date are written, so status and assignee are left as they are.
export async function updateTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const result = await prisma.task.updateMany({
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
    data: {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return { id: taskId };
}

// Scoped the same way as updates. A count of 0 covers missing, inaccessible,
// and already-deleted tasks, so repeated delete requests are harmless.
export async function deleteTask(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
) {
  const result = await prisma.task.deleteMany({
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
  });

  return result.count > 0;
}

type UpdateTaskAssigneeResult =
  | { ok: true; task: { id: string; assigneeId: string | null } }
  | { ok: false; error: "NOT_FOUND" | "INVALID_ASSIGNEE" };

export async function updateTaskAssignee(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  assigneeId: string | null,
): Promise<UpdateTaskAssigneeResult> {
  const workspaceConditions: Prisma.WorkspaceWhereInput[] = [
    { members: { some: { userId } } },
  ];

  // The assignee must be a member of the task's own workspace. Checking it in
  // the update's WHERE clause makes the membership check and the write a
  // single statement, so there's no gap between checking and writing.
  if (assigneeId) {
    workspaceConditions.push({ members: { some: { id: assigneeId } } });
  }

  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      project: {
        slug: projectSlug,
        workspace: {
          slug: workspaceSlug,
          AND: workspaceConditions,
        },
      },
    },
    data: {
      assigneeId,
    },
  });

  if (result.count > 0) {
    return { ok: true, task: { id: taskId, assigneeId } };
  }

  // Nothing matched, so work out which response to give. This read only
  // picks the error; it doesn't authorize anything.
  const task = assigneeId
    ? await getProjectTask(userId, workspaceSlug, projectSlug, taskId)
    : null;

  return { ok: false, error: task ? "INVALID_ASSIGNEE" : "NOT_FOUND" };
}
