"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import type { TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/task";
import { verifyEmailPath } from "@/lib/verify-email-path";

type FieldErrors = {
  title?: string[];
  description?: string[];
  priority?: string[];
  dueDate?: string[];
};

type TaskDetailsProps = {
  taskUrl: string;
  projectHref: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  readOnly: boolean;
};

export function TaskDetails({
  taskUrl,
  projectHref,
  title,
  description,
  priority,
  dueDate,
  readOnly,
}: TaskDetailsProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  function startEditing() {
    setFieldErrors({});
    setFormError("");
    setIsEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);

    const payload = {
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority"),
      dueDate: formData.get("dueDate"),
    };

    try {
      const response = await fetch(`/api${taskUrl}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

        if (data.error === "VALIDATION_ERROR") {
          setFieldErrors(data.fields ?? {});
          return;
        }

        setFormError(data.message ?? "Unable to save the task.");
        return;
      }

      // Leaving edit mode inside the transition means the saved values from
      // the refresh replace the form in one step.
      startTransition(() => {
        setIsEditing(false);
        router.refresh();
      });
    } catch {
      setFormError("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this task? This can't be undone.")) {
      return;
    }

    setFormError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api${taskUrl}`, { method: "DELETE" });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      // A 404 means the task is already gone, for example after a repeated
      // request, so there's nothing left to show on this page either.
      if (response.ok || response.status === 404) {
        router.replace(projectHref);
        return;
      }

      const data = await response.json();

      if (data.error === "EMAIL_NOT_VERIFIED") {
        router.push(verifyEmailPath(window.location.pathname));
        return;
      }

      setFormError(data.message ?? "Unable to delete the task.");
      setIsDeleting(false);
    } catch {
      setFormError("Something went wrong while deleting. Please try again.");
      setIsDeleting(false);
    }
  }

  if (isEditing && !readOnly) {
    const isBusy = isSaving || isRefreshing;

    return (
      <form className="space-y-5" onSubmit={handleSave}>
        {formError && (
          <div role="alert" className="tk-alert-error">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="title" className="tk-label">
            Title
          </label>

          <input
            id="title"
            name="title"
            type="text"
            defaultValue={title}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
            className="tk-input mt-2"
          />

          {fieldErrors.title?.[0] && (
            <p id="title-error" className="tk-field-error">
              {fieldErrors.title[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="tk-label">
            Description{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>

          <textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={description ?? ""}
            maxLength={2000}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={
              fieldErrors.description ? "description-error" : undefined
            }
            className="tk-input tk-textarea mt-2"
          />

          {fieldErrors.description?.[0] && (
            <p id="description-error" className="tk-field-error">
              {fieldErrors.description[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="priority" className="tk-label">
            Priority
          </label>

          <select
            id="priority"
            name="priority"
            defaultValue={priority}
            aria-invalid={Boolean(fieldErrors.priority)}
            aria-describedby={fieldErrors.priority ? "priority-error" : undefined}
            className="tk-input mt-2 sm:w-60"
          >
            {TASK_PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {TASK_PRIORITY_LABELS[option]}
              </option>
            ))}
          </select>

          {fieldErrors.priority?.[0] && (
            <p id="priority-error" className="tk-field-error">
              {fieldErrors.priority[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="dueDate" className="tk-label">
            Due date{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>

          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={dueDate ?? ""}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            aria-describedby={fieldErrors.dueDate ? "dueDate-error" : undefined}
            className="tk-input mt-2 sm:w-60"
          />

          {fieldErrors.dueDate?.[0] && (
            <p id="dueDate-error" className="tk-field-error">
              {fieldErrors.dueDate[0]}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isBusy}
            className="tk-btn tk-btn-primary"
          >
            {isBusy ? "Saving..." : "Save changes"}
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isBusy}
            className="tk-btn tk-btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="tk-page-title min-w-0 break-words">{title}</h1>

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={startEditing}
              disabled={isDeleting}
              className="tk-btn tk-btn-secondary tk-btn-sm"
            >
              Edit task
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="tk-btn tk-btn-sm text-red-700 hover:bg-red-50"
            >
              {isDeleting ? "Deleting..." : "Delete task"}
            </button>
          </div>
        )}
      </div>

      {formError && (
        <div role="alert" className="tk-alert-error mt-4">
          {formError}
        </div>
      )}

      <section aria-labelledby="description-heading" className="mt-6">
        <h2
          id="description-heading"
          className="text-xs font-medium tracking-wide text-zinc-500 uppercase"
        >
          Description
        </h2>

        {description ? (
          <p className="mt-2 text-sm leading-7 break-words whitespace-pre-line text-zinc-700">
            {description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            {readOnly
              ? "No description."
              : "No description yet. Use Edit task to add one."}
          </p>
        )}
      </section>
    </div>
  );
}
