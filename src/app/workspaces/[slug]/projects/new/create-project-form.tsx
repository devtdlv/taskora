"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type FieldErrors = {
  name?: string[];
  description?: string[];
};

type CreateProjectFormProps = {
  workspaceSlug: string;
};

export function CreateProjectForm({ workspaceSlug }: CreateProjectFormProps) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const payload = {
      name: formData.get("name"),
      description: formData.get("description"),
    };

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "VALIDATION_ERROR") {
          setFieldErrors(data.fields ?? {});
          return;
        }

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setFormError(data.message ?? "Unable to create your project.");
        return;
      }

      router.push(`/workspaces/${workspaceSlug}/projects/${data.project.slug}`);
    } catch {
      setFormError(
        "Something went wrong while creating your project. Please try again.",
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
        <label htmlFor="name" className="tk-label">
          Project name
        </label>

        <input
          id="name"
          name="name"
          type="text"
          placeholder="Website redesign"
          maxLength={80}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
          className="tk-input mt-2"
        />

        {fieldErrors.name?.[0] && (
          <p id="name-error" className="tk-field-error">
            {fieldErrors.name[0]}
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
          rows={4}
          maxLength={500}
          placeholder="What is this project about?"
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {isSubmitting ? "Creating project..." : "Create project"}
      </button>
    </form>
  );
}
