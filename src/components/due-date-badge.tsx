"use client";

import { useSyncExternalStore } from "react";

import { type DueDateState, getDueDateState } from "@/lib/task";

const STATE_CLASSES: Record<DueDateState, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200",
  today: "bg-amber-50 text-amber-800 ring-amber-200",
  upcoming: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function subscribe() {
  return () => {};
}

function getLocalToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

// "Today" depends on the viewer's timezone, which the server doesn't know.
// The server render gets null and shows a neutral label, then the browser
// fills in the overdue and due-today states after hydration.
function useLocalToday() {
  return useSyncExternalStore(subscribe, getLocalToday, () => null);
}

function formatDate(dueDate: string, today: string | null) {
  const sameYear = today !== null && today.slice(0, 4) === dueDate.slice(0, 4);

  return new Date(`${dueDate}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

type DueDateBadgeProps = {
  dueDate: string;
  isDone: boolean;
};

export function DueDateBadge({ dueDate, isDone }: DueDateBadgeProps) {
  const today = useLocalToday();
  const date = formatDate(dueDate, today);

  let state: DueDateState = "upcoming";
  let label = `Due ${date}`;

  if (isDone) {
    state = "completed";
    label = `Completed, due ${date}`;
  } else if (today) {
    state = getDueDateState(dueDate, false, today);

    if (state === "overdue") {
      label = `Overdue, due ${date}`;
    } else if (state === "today") {
      label = "Due today";
    }
  }

  return (
    <time
      dateTime={dueDate}
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATE_CLASSES[state]}`}
    >
      {label}
    </time>
  );
}
