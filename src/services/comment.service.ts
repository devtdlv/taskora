import { prisma } from "@/lib/prisma";
import { writeToActiveProject } from "@/services/project-lock";

export async function getTaskComments(taskId: string) {
  return prisma.taskComment.findMany({
    where: {
      taskId,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      body: true,
      authorId: true,
      createdAt: true,
      author: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

// writeToActiveProject has already matched the project through the user's
// membership and confirmed it isn't archived, so the task only has to belong
// to that project. A null value means the task is missing or inaccessible.
export async function createTaskComment(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  body: string,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      // The key-share lock makes a concurrent task delete wait until the
      // comment is in, instead of the insert failing its foreign key.
      const [task] = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "tasks"
        WHERE "id" = ${taskId} AND "projectId" = ${project.id}
        FOR KEY SHARE
      `;

      if (!task) {
        return null;
      }

      return tx.taskComment.create({
        data: {
          body,
          taskId: task.id,
          authorId: userId,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
        },
      });
    },
  );
}

// Only the author can delete a comment, and only while they still have access
// to the task's workspace and the project is active. A false value covers
// missing, other people's, and already-deleted comments alike.
export async function deleteTaskComment(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
  commentId: string,
) {
  return writeToActiveProject(
    userId,
    workspaceSlug,
    projectSlug,
    async (tx, project) => {
      const result = await tx.taskComment.deleteMany({
        where: {
          id: commentId,
          authorId: userId,
          task: {
            id: taskId,
            projectId: project.id,
          },
        },
      });

      return result.count > 0;
    },
  );
}
