import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";

export type TaskCountGroup = {
  status: TaskStatus;
  priority: TaskPriority;
  count: number;
};

export type ProjectAnalytics = {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  completionPercent: number;
};

// Rounded down, so 100% only appears once every task is done. An empty
// project is 0% complete.
export function completionPercent(done: number, total: number) {
  return total === 0 ? 0 : Math.floor((done / total) * 100);
}

// Folds per-(status, priority) counts into totals for each status and each
// priority. Every status and priority is present, even when its count is 0.
export function summarizeTaskCounts(groups: TaskCountGroup[]): ProjectAnalytics {
  const byStatus: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  const byPriority: Record<TaskPriority, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
  let total = 0;

  for (const { status, priority, count } of groups) {
    byStatus[status] += count;
    byPriority[priority] += count;
    total += count;
  }

  return {
    total,
    byStatus,
    byPriority,
    completionPercent: completionPercent(byStatus.DONE, total),
  };
}
