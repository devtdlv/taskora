import type { TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/task";

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  LOW: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  MEDIUM: "bg-blue-50 text-blue-700 ring-blue-200",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-200",
  URGENT: "bg-red-50 text-red-700 ring-red-200",
};

const BAR_HEIGHTS = ["h-1", "h-1.5", "h-2", "h-2.5"];

type PriorityBadgeProps = {
  priority: TaskPriority;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const level = TASK_PRIORITIES.indexOf(priority);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${PRIORITY_CLASSES[priority]}`}
    >
      <span aria-hidden="true" className="inline-flex h-2.5 items-end gap-px">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={`w-[3px] rounded-[1px] bg-current ${height} ${
              index <= level ? "" : "opacity-25"
            }`}
          />
        ))}
      </span>
      {TASK_PRIORITY_LABELS[priority]}
      <span className="sr-only"> priority</span>
    </span>
  );
}
