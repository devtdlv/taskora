import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "@/lib/validations/task";
import { writeToActiveProject } from "@/services/project-lock";

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
    (tx, project) =>
      tx.task.create({
        data: {
          projectId: project.id,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
        },
      }),
  );
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
}

// The task writes below run through writeToActiveProject, which has already
// matched the project through the user's membership and confirmed it isn't
// archived. Each write is then limited to that project, so a task ID from
// another project matches nothing. A null or false value means the task is
// missing or already gone.
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
      const result = await tx.task.updateMany({
        where: {
          id: taskId,
          projectId: project.id,
        },
        data: {
          status,
        },
      });

      return result.count > 0 ? { id: taskId, status } : null;
    },
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
      const result = await tx.task.deleteMany({
        where: {
          id: taskId,
          projectId: project.id,
        },
      });

      return result.count > 0;
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
