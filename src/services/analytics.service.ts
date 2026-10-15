import { summarizeTaskCounts } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getWorkspaceProject } from "@/services/project.service";

// Read-only. The project is found through the user's workspace membership
// first, so missing and inaccessible projects both return null, and the counts
// only ever cover that one project's tasks. Archived projects are included:
// they stay readable to their workspace.
export async function getProjectAnalytics(
  userId: string,
  workspaceSlug: string,
  projectSlug: string,
) {
  const project = await getWorkspaceProject(userId, workspaceSlug, projectSlug);

  if (!project) {
    return null;
  }

  const groups = await prisma.task.groupBy({
    by: ["status", "priority"],
    where: {
      projectId: project.id,
    },
    _count: {
      _all: true,
    },
  });

  return {
    project,
    analytics: summarizeTaskCounts(
      groups.map((group) => ({
        status: group.status,
        priority: group.priority,
        count: group._count._all,
      })),
    ),
  };
}
