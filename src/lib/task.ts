import type { TaskStatus } from "@/generated/prisma/enums";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

// Due dates are stored as date-only values at midnight UTC, so the UTC date
// part is the saved calendar date. Converting to the viewer's local timezone
// would show the previous day west of UTC.
export function toDateOnly(dueDate: Date) {
  return dueDate.toISOString().slice(0, 10);
}

export type DueDateState = "overdue" | "today" | "upcoming" | "completed";

// Both dates are YYYY-MM-DD strings, so comparing them as strings compares
// calendar dates without any timezone conversion.
export function getDueDateState(
  dueDate: string,
  isDone: boolean,
  today: string,
): DueDateState {
  if (isDone) {
    return "completed";
  }

  if (dueDate < today) {
    return "overdue";
  }

  return dueDate === today ? "today" : "upcoming";
}
