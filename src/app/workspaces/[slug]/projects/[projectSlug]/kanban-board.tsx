"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DueDateBadge } from "@/components/due-date-badge";
import type { TaskStatus } from "@/generated/prisma/enums";
import { getInitials } from "@/lib/initials";
import { TASK_STATUS_LABELS } from "@/lib/task";
import { verifyEmailPath } from "@/lib/verify-email-path";

type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  // A YYYY-MM-DD calendar date.
  dueDate: string | null;
  assigneeName: string | null;
};

type KanbanBoardProps = {
  projectHref: string;
  tasks: BoardTask[];
  // Archived projects show the board without the status controls.
  readOnly: boolean;
};

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

const COLUMN_DOT_CLASSES: Record<TaskStatus, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-indigo-500",
  DONE: "bg-emerald-500",
};

export function KanbanBoard({
  projectHref,
  tasks,
  readOnly,
}: KanbanBoardProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [updating, setUpdating] = useState<{
    taskId: string;
    status: TaskStatus;
  } | null>(null);
  const [error, setError] = useState<{ taskId: string; message: string } | null>(
    null,
  );

  const isBusy = updating !== null || isRefreshing;

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setError(null);
    setUpdating({ taskId, status });

    try {
      const response = await fetch(`/api${projectHref}/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(verifyEmailPath(window.location.pathname));
          return;
        }

        setUpdating(null);
        setError({
          taskId,
          message: data.message ?? "Unable to update the status.",
        });
        return;
      }

      // Clearing the pending state inside the transition means it's applied
      // together with the refreshed tasks, so the card doesn't briefly jump
      // back to its old status before moving to the new column.
      startTransition(() => {
        setUpdating(null);
        router.refresh();
      });
    } catch {
      setUpdating(null);
      setError({
        taskId,
        message: "Something went wrong while updating the status.",
      });
    }
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-start">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column);
        const headingId = `column-${column}`;

        return (
          <section
            key={column}
            aria-labelledby={headingId}
            className="min-w-0 rounded-xl border border-line bg-zinc-100/60 p-2"
          >
            <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-2.5">
              <h3
                id={headingId}
                className="flex items-center gap-2 text-sm font-semibold text-ink"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${COLUMN_DOT_CLASSES[column]}`}
                />
                {TASK_STATUS_LABELS[column]}
              </h3>

              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-line">
                {columnTasks.length}
                <span className="sr-only">
                  {columnTasks.length === 1 ? " task" : " tasks"}
                </span>
              </span>
            </div>

            {columnTasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-zinc-500">
                No tasks
              </p>
            ) : (
              <ul className="space-y-2">
                {columnTasks.map((task) => {
                  const isDone = task.status === "DONE";
                  const hasError = error?.taskId === task.id;

                  return (
                    <li
                      key={task.id}
                      className="relative rounded-lg border border-line bg-surface p-3 shadow-xs transition hover:border-zinc-300 hover:shadow-sm has-[a:focus-visible]:border-indigo-500 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-indigo-500/20"
                    >
                      {/* The link covers the whole card, so the card is one
                          large target. The status select sits above it. */}
                      <Link
                        href={`${projectHref}/tasks/${task.id}`}
                        className={`block text-sm leading-5 font-medium break-words outline-none after:absolute after:inset-0 after:rounded-lg hover:text-indigo-700 ${
                          isDone ? "text-zinc-500" : "text-ink"
                        }`}
                      >
                        {task.title}
                      </Link>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs">
                          {task.assigneeName ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700"
                              >
                                {getInitials(task.assigneeName)}
                              </span>
                              <span className="truncate text-zinc-700">
                                {task.assigneeName}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-500">Unassigned</span>
                          )}
                        </span>

                        {task.dueDate && (
                          <DueDateBadge dueDate={task.dueDate} isDone={isDone} />
                        )}
                      </div>

                      {!readOnly && (
                        <select
                          aria-label={`Status for ${task.title}`}
                          value={
                            updating?.taskId === task.id
                              ? updating.status
                              : task.status
                          }
                          onChange={(event) =>
                            handleStatusChange(
                              task.id,
                              event.target.value as TaskStatus,
                            )
                          }
                          disabled={isBusy}
                          aria-describedby={
                            hasError ? `status-error-${task.id}` : undefined
                          }
                          className="tk-input tk-input-sm relative z-10 mt-3 h-10 cursor-pointer bg-zinc-50 text-sm font-medium text-zinc-700 shadow-none hover:bg-white md:h-8 md:text-xs"
                        >
                          {COLUMNS.map((status) => (
                            <option key={status} value={status}>
                              {TASK_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}

                      {hasError && (
                        <p
                          id={`status-error-${task.id}`}
                          className="tk-field-error relative z-10"
                        >
                          {error?.message}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
