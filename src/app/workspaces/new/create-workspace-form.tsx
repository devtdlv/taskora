"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { showFieldErrors } from "@/lib/focus-invalid-field";
import { verifyEmailPath } from "@/lib/verify-email-path";

type FieldErrors = {
  name?: string[];
};

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: formData.get("name") }),
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

        setFormError(data.message ?? "Unable to create your workspace.");
        return;
      }

      router.push(`/workspaces/${data.workspace.slug}`);
    } catch {
      setFormError(
        "Something went wrong while creating your workspace. Please try again.",
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
          Workspace name
        </label>

        <input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          placeholder="Acme Inc."
          maxLength={50}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : "name-hint"}
          className="tk-input mt-2"
        />

        {fieldErrors.name?.[0] ? (
          <p id="name-error" className="tk-field-error">
            {fieldErrors.name[0]}
          </p>
        ) : (
          <p id="name-hint" className="tk-hint">
            Usually your company or team name.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {isSubmitting ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}
