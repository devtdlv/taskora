"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { showFieldErrors } from "@/lib/focus-invalid-field";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/task";
import { verifyEmailPath } from "@/lib/verify-email-path";

type FieldErrors = {
  title?: string[];
  description?: string[];
  priority?: string[];
  dueDate?: string[];
};

type CreateTaskFormProps = {
  workspaceSlug: string;
  projectSlug: string;
};

export function CreateTaskForm({
  workspaceSlug,
  projectSlug,
}: CreateTaskFormProps) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectPath = `/workspaces/${workspaceSlug}/projects/${projectSlug}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority"),
      dueDate: formData.get("dueDate"),
    };

    try {
      const response = await fetch(`/api${projectPath}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "VALIDATION_ERROR") {
          showFieldErrors(form, () => setFieldErrors(data.fields ?? {}));
          return;
        }

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(verifyEmailPath(window.location.pathname));
          return;
        }

        setFormError(data.message ?? "Unable to create your task.");
        return;
      }

      router.push(`${projectPath}/tasks/${data.task.id}`);
    } catch {
      setFormError(
        "Something went wrong while creating your task. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
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
          placeholder="Draft homepage copy"
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
          Description <span className="font-normal text-zinc-500">(optional)</span>
        </label>

        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          placeholder="Add any details that will help get this done."
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
          defaultValue="MEDIUM"
          aria-invalid={Boolean(fieldErrors.priority)}
          aria-describedby={fieldErrors.priority ? "priority-error" : undefined}
          className="tk-input mt-2"
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
          Due date <span className="font-normal text-zinc-500">(optional)</span>
        </label>

        <input
          id="dueDate"
          name="dueDate"
          type="date"
          aria-invalid={Boolean(fieldErrors.dueDate)}
          aria-describedby={fieldErrors.dueDate ? "dueDate-error" : undefined}
          className="tk-input mt-2"
        />

        {fieldErrors.dueDate?.[0] && (
          <p id="dueDate-error" className="tk-field-error">
            {fieldErrors.dueDate[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {isSubmitting ? "Creating task..." : "Create task"}
      </button>
    </form>
  );
}
