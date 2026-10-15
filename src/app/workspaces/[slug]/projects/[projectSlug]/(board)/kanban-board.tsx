"use client";

import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { DueDateBadge } from "@/components/due-date-badge";
import { PriorityBadge } from "@/components/priority-badge";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { getInitials } from "@/lib/initials";
import { TASK_STATUS_LABELS } from "@/lib/task";
import { verifyEmailPath } from "@/lib/verify-email-path";

type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  // A YYYY-MM-DD calendar date.
  dueDate: string | null;
  assigneeName: string | null;
};

type KanbanBoardProps = {
  projectHref: string;
  // In saved order within each column.
  tasks: BoardTask[];
  // Archived projects show the board without the status controls.
  readOnly: boolean;
};

type Columns = Record<TaskStatus, string[]>;

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

const COLUMN_DOT_CLASSES: Record<TaskStatus, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-indigo-500",
  DONE: "bg-emerald-500",
};

const COLUMN_ID_PREFIX = "column:";

const SCREEN_READER_INSTRUCTIONS =
  "To move a task, focus its move handle and press Space or Enter. Use the arrow keys to move it within a column or to another column. Press Space or Enter again to drop it, or Escape to cancel.";

function groupTasks(tasks: BoardTask[]): Columns {
  const columns: Columns = { TODO: [], IN_PROGRESS: [], DONE: [] };

  for (const task of tasks) {
    columns[task.status].push(task.id);
  }

  return columns;
}

// Accepts a task ID or a column's droppable ID.
function findColumn(columns: Columns, id: string): TaskStatus | null {
  if (id.startsWith(COLUMN_ID_PREFIX)) {
    return id.slice(COLUMN_ID_PREFIX.length) as TaskStatus;
  }

  return COLUMNS.find((status) => columns[status].includes(id)) ?? null;
}

export function KanbanBoard({
  projectHref,
  tasks,
  readOnly,
}: KanbanBoardProps) {
  const router = useRouter();
  const dndId = useId();
  const [isRefreshing, startTransition] = useTransition();
  const [updating, setUpdating] = useState<{
    taskId: string;
    status: TaskStatus;
  } | null>(null);
  const [error, setError] = useState<{ taskId: string; message: string } | null>(
    null,
  );
  const [boardError, setBoardError] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  // A card whose status changed moves to another column and is remounted,
  // which drops focus. Its status menu is focused again once the board settles.
  const refocusTaskId = useRef<string | null>(null);
  // The board while a card is being dragged or its move is saving. Clearing
  // it shows the saved order from the server again, which is also how a
  // failed move is undone.
  const [draft, setDraft] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const dragStart = useRef<{ status: TaskStatus; index: number } | null>(null);

  const saved = useMemo(() => groupTasks(tasks), [tasks]);
  const columns = draft ?? saved;
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const isBusy = updating !== null || isMoving || isRefreshing;

  useEffect(() => {
    if (isBusy || !refocusTaskId.current) {
      return;
    }

    document.getElementById(`status-${refocusTaskId.current}`)?.focus();
    refocusTaskId.current = null;
  }, [isBusy, tasks]);

  const sensors = useSensors(
    // A short distance lets the handle still be focused and clicked.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function titleOf(id: string | number) {
    return tasksById.get(String(id))?.title ?? "Task";
  }

  // Describes where the dragged card would land if dropped on overId. The
  // announcement runs before the board re-renders, and reordering within a
  // column is only applied on drop, so the card's own place can't be used.
  function placeOf(activeId: string | number, overId: string | number) {
    const status = findColumn(columns, String(overId));

    if (!status) {
      return "";
    }

    const items = columns[status];
    const count = items.includes(String(activeId)) ? items.length : items.length + 1;
    const index = items.indexOf(String(overId));
    const position = index === -1 ? count : index + 1;

    return `${TASK_STATUS_LABELS[status]}, position ${position} of ${count}`;
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${titleOf(active.id)}. It's in ${placeOf(active.id, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} is now in ${placeOf(active.id, over.id)}.`
        : `${titleOf(active.id)} is no longer over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${titleOf(active.id)} in ${placeOf(active.id, over.id)}.`
        : `Dropped ${titleOf(active.id)}. It wasn't moved.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${titleOf(active.id)} is back where it was.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    const taskId = String(active.id);
    const status = findColumn(saved, taskId);

    if (!status) {
      return;
    }

    setError(null);
    setBoardError("");
    setActiveId(taskId);
    setDraft(saved);
    dragStart.current = { status, index: saved[status].indexOf(taskId) };
  }

  // Moving into another column happens while dragging, so the card shows where
  // it will land. Reordering within a column is drawn by the sortable list
  // and only applied on drop.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      return;
    }

    const taskId = String(active.id);
    const overId = String(over.id);

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const from = findColumn(current, taskId);
      const to = findColumn(current, overId);

      if (!from || !to || from === to) {
        return current;
      }

      const target = [...current[to]];
      const overIndex = target.indexOf(overId);

      target.splice(overIndex === -1 ? target.length : overIndex, 0, taskId);

      return {
        ...current,
        [from]: current[from].filter((id) => id !== taskId),
        [to]: target,
      };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const taskId = String(active.id);
    const start = dragStart.current;

    setActiveId(null);
    dragStart.current = null;

    if (!draft || !over || !start) {
      setDraft(null);
      return;
    }

    const status = findColumn(draft, taskId);

    if (!status) {
      setDraft(null);
      return;
    }

    let next = draft;
    const items = draft[status];
    const overIndex = items.indexOf(String(over.id));

    if (overIndex !== -1 && String(over.id) !== taskId) {
      next = {
        ...draft,
        [status]: arrayMove(items, items.indexOf(taskId), overIndex),
      };
    }

    const index = next[status].indexOf(taskId);

    if (status === start.status && index === start.index) {
      setDraft(null);
      return;
    }

    setDraft(next);
    void saveMove(taskId, status, index);
  }

  function handleDragCancel() {
    setActiveId(null);
    dragStart.current = null;
    setDraft(null);
  }

  async function saveMove(taskId: string, status: TaskStatus, index: number) {
    setIsMoving(true);

    try {
      const response = await fetch(`/api${projectHref}/tasks/${taskId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, index }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(verifyEmailPath(window.location.pathname));
          return;
        }

        // Put the board back and pick up whatever changed on the server, such
        // as the task being deleted or the project archived.
        setDraft(null);
        setIsMoving(false);
        setBoardError(
          `${data.message ?? "Unable to move the task."} The board was restored.`,
        );
        router.refresh();
        return;
      }

      // Clearing the draft inside the transition applies it together with the
      // refreshed tasks, so the card doesn't jump back before settling.
      startTransition(() => {
        setDraft(null);
        setIsMoving(false);
        router.refresh();
      });
    } catch {
      setDraft(null);
      setIsMoving(false);
      setBoardError(
        "Something went wrong while moving the task. The board was restored.",
      );
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setError(null);
    setBoardError("");
    setStatusNotice("");
    setUpdating({ taskId, status });
    refocusTaskId.current = taskId;

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
        setStatusNotice(`Moved ${titleOf(taskId)} to ${TASK_STATUS_LABELS[status]}.`);
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

  const activeTask = activeId ? tasksById.get(activeId) : undefined;
  const activeStatus = activeId ? findColumn(columns, activeId) : null;

  return (
    <div className="mt-4">
      {!readOnly && (
        <p className="text-xs text-zinc-500">
          Drag a card by its handle to reorder it or move it to another column,
          or change its status from the menu on the card.
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {isMoving ? "Saving the new order..." : statusNotice}
      </p>

      {boardError && (
        <div role="alert" className="tk-alert-error mt-3">
          {boardError}
        </div>
      )}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: SCREEN_READER_INSTRUCTIONS },
        }}
      >
        <div
          aria-busy={isMoving}
          className="mt-3 grid gap-4 md:grid-cols-3 md:items-start"
        >
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column}
              status={column}
              taskIds={columns[column]}
              isTarget={activeStatus === column}
            >
              {columns[column].map((taskId) => {
                const task = tasksById.get(taskId);

                if (!task) {
                  return null;
                }

                return (
                  <SortableCard
                    key={taskId}
                    task={task}
                    status={column}
                    projectHref={projectHref}
                    readOnly={readOnly}
                    isBusy={isBusy}
                    selectedStatus={
                      updating?.taskId === taskId ? updating.status : column
                    }
                    error={error?.taskId === taskId ? error.message : null}
                    onStatusChange={handleStatusChange}
                  />
                );
              })}
            </BoardColumn>
          ))}
        </div>

        <DragOverlay>
          {activeTask && activeStatus ? (
            <div className="rotate-1 rounded-lg border border-indigo-300 bg-surface p-3 shadow-lg ring-3 ring-indigo-500/20">
              <CardSummary task={activeTask} isDone={activeStatus === "DONE"} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumn({
  status,
  taskIds,
  isTarget,
  children,
}: {
  status: TaskStatus;
  taskIds: string[];
  isTarget: boolean;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN_ID_PREFIX}${status}` });
  const headingId = `column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`min-w-0 rounded-xl border p-2 transition-colors ${
        isTarget
          ? "border-indigo-300 bg-indigo-50/60"
          : "border-line bg-zinc-100/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-2.5">
        <h3
          id={headingId}
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${COLUMN_DOT_CLASSES[status]}`}
          />
          {TASK_STATUS_LABELS[status]}
        </h3>

        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-line">
          {taskIds.length}
          <span className="sr-only">{taskIds.length === 1 ? " task" : " tasks"}</span>
        </span>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {taskIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-zinc-500">
            No tasks
          </p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </SortableContext>
    </section>
  );
}

function CardSummary({ task, isDone }: { task: BoardTask; isDone: boolean }) {
  return (
    <>
      <p
        className={`text-sm leading-5 font-medium break-words ${
          isDone ? "text-zinc-500" : "text-ink"
        }`}
      >
        {task.title}
      </p>
      <CardMeta task={task} isDone={isDone} />
    </>
  );
}

function CardMeta({ task, isDone }: { task: BoardTask; isDone: boolean }) {
  return (
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
            <span className="truncate text-zinc-700">{task.assigneeName}</span>
          </>
        ) : (
          <span className="text-zinc-500">Unassigned</span>
        )}
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && <DueDateBadge dueDate={task.dueDate} isDone={isDone} />}
      </span>
    </div>
  );
}

type SortableCardProps = {
  task: BoardTask;
  // The column the card is shown in, which differs from task.status while
  // it's being dragged to another column.
  status: TaskStatus;
  projectHref: string;
  readOnly: boolean;
  isBusy: boolean;
  selectedStatus: TaskStatus;
  error: string | null;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
};

function SortableCard({
  task,
  status,
  projectHref,
  readOnly,
  isBusy,
  selectedStatus,
  error,
  onStatusChange,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: readOnly || isBusy,
    attributes: { roleDescription: "movable task" },
  });

  const isDone = status === "DONE";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={`relative rounded-lg border bg-surface p-3 shadow-xs transition-[border-color,box-shadow,opacity] has-[a:focus-visible]:border-indigo-500 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-indigo-500/20 ${
        isDragging
          ? "border-dashed border-indigo-300 opacity-40"
          : "border-line hover:border-zinc-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* The link covers the whole card, so the card is one large target.
            The move handle and status select sit above it. */}
        <Link
          href={`${projectHref}/tasks/${task.id}`}
          className={`min-w-0 flex-1 text-sm leading-5 font-medium break-words outline-none after:absolute after:inset-0 after:rounded-lg hover:text-indigo-700 ${
            isDone ? "text-zinc-500" : "text-ink"
          }`}
        >
          {task.title}
        </Link>

        {!readOnly && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Move ${task.title}`}
            className="relative z-10 -mt-1.5 -mr-1.5 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 outline-none hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-3 focus-visible:ring-indigo-500/30 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 md:size-7"
            {...attributes}
            {...listeners}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="currentColor"
            >
              <circle cx="5.5" cy="3.5" r="1.25" />
              <circle cx="10.5" cy="3.5" r="1.25" />
              <circle cx="5.5" cy="8" r="1.25" />
              <circle cx="10.5" cy="8" r="1.25" />
              <circle cx="5.5" cy="12.5" r="1.25" />
              <circle cx="10.5" cy="12.5" r="1.25" />
            </svg>
          </button>
        )}
      </div>

      <CardMeta task={task} isDone={isDone} />

      {!readOnly && (
        <select
          id={`status-${task.id}`}
          aria-label={`Status for ${task.title}`}
          value={selectedStatus}
          onChange={(event) =>
            onStatusChange(task.id, event.target.value as TaskStatus)
          }
          disabled={isBusy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `status-error-${task.id}` : undefined}
          className="tk-input tk-input-sm relative z-10 mt-3 h-10 cursor-pointer bg-zinc-50 text-sm font-medium text-zinc-700 shadow-none hover:bg-white md:h-8 md:text-xs"
        >
          {COLUMNS.map((option) => (
            <option key={option} value={option}>
              {TASK_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      )}

      {error && (
        <p
          id={`status-error-${task.id}`}
          role="alert"
          className="tk-field-error relative z-10"
        >
          {error}
        </p>
      )}
    </li>
  );
}
