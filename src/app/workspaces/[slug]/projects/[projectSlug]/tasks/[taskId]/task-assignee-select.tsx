"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState, useTransition } from "react";

type AssigneeOption = {
  id: string;
  label: string;
};

type TaskAssigneeSelectProps = {
  taskUrl: string;
  assigneeId: string | null;
  members: AssigneeOption[];
};

export function TaskAssigneeSelect({
  taskUrl,
  assigneeId,
  members,
}: TaskAssigneeSelectProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;

    setError("");
    setPendingValue(value);

    try {
      const response = await fetch(`/api${taskUrl}/assignee`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assigneeId: value || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setPendingValue(null);
        setError(data.message ?? "Unable to update the assignee.");
        return;
      }

      startTransition(() => {
        setPendingValue(null);
        router.refresh();
      });
    } catch {
      setPendingValue(null);
      setError("Something went wrong while updating the assignee.");
    }
  }

  return (
    <div>
      <label htmlFor="assignee" className="tk-label">
        Assignee
      </label>

      <select
        id="assignee"
        value={pendingValue ?? assigneeId ?? ""}
        onChange={handleChange}
        disabled={pendingValue !== null || isRefreshing}
        aria-describedby={error ? "assignee-error" : undefined}
        className="tk-input mt-2"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.label}
          </option>
        ))}
      </select>

      {error && (
        <p id="assignee-error" className="tk-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
