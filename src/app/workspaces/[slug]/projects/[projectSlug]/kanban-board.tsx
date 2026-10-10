"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUS_LABELS } from "@/lib/task";

type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  assigneeName: string | null;
};

type KanbanBoardProps = {
  projectHref: string;
  tasks: BoardTask[];
};

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

const COLUMN_DOT_CLASSES: Record<TaskStatus, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  DONE: "bg-green-500",
};

export function KanbanBoard({ projectHref, tasks }: KanbanBoardProps) {
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
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column);

        return (
          <section key={column} className="rounded-xl bg-zinc-50 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${COLUMN_DOT_CLASSES[column]}`}
                />
                {TASK_STATUS_LABELS[column]}
              </h3>

              <span className="text-xs text-zinc-500">
                {columnTasks.length}
              </span>
            </div>

            {columnTasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                No tasks
              </p>
            ) : (
              <ul className="space-y-3">
                {columnTasks.map((task) => (
                  <li
                    key={task.id}
                    className="tk-card tk-card-interactive p-4"
                  >
                    <Link
                      href={`${projectHref}/tasks/${task.id}`}
                      className={`block text-sm font-medium hover:underline ${
                        task.status === "DONE" ? "text-zinc-500" : ""
                      }`}
                    >
                      {task.title}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span
                        className={task.assigneeName ? "text-zinc-700" : ""}
                      >
                        {task.assigneeName ?? "Unassigned"}
                      </span>

                      {task.dueDate && <span>Due {task.dueDate}</span>}
                    </div>

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
                        error?.taskId === task.id
                          ? `status-error-${task.id}`
                          : undefined
                      }
                      className="tk-input tk-input-sm mt-3"
                    >
                      {COLUMNS.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    {error?.taskId === task.id && (
                      <p
                        id={`status-error-${task.id}`}
                        className="tk-field-error"
                      >
                        {error.message}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
