"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";

import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUS_LABELS } from "@/lib/task";

type TaskStatusSelectProps = {
  taskUrl: string;
  initialStatus: TaskStatus;
};

export function TaskStatusSelect({
  taskUrl,
  initialStatus,
}: TaskStatusSelectProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api${taskUrl}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: event.target.value }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setError(data.message ?? "Unable to update the status.");
        return;
      }

      setStatus(data.task.status);
    } catch {
      setError("Something went wrong while updating the status.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor="status" className="tk-label">
        Status
      </label>

      <select
        id="status"
        value={status}
        onChange={handleChange}
        disabled={isSaving}
        aria-describedby={error ? "status-error" : undefined}
        className="tk-input mt-2"
      >
        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {error && (
        <p id="status-error" className="tk-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
