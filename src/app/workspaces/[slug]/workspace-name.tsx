"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import { verifyEmailPath } from "@/lib/verify-email-path";

type WorkspaceNameProps = {
  workspaceSlug: string;
  name: string;
  isOwner: boolean;
};

export function WorkspaceName({ workspaceSlug, name, isOwner }: WorkspaceNameProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldError("");
    setFormError("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: formData.get("name") }),
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

        if (data.error === "VALIDATION_ERROR") {
          setFieldError(data.fields?.name?.[0] ?? "Enter a valid name.");
          return;
        }

        setFormError(data.message ?? "Unable to rename the workspace.");
        return;
      }

      const newSlug: string = data.workspace.slug;

      startTransition(() => {
        setIsEditing(false);
        setNotice("Workspace renamed.");

        // The old address stops working when the slug changes.
        if (newSlug !== workspaceSlug) {
          router.replace(`/workspaces/${newSlug}`);
        } else {
          router.refresh();
        }
      });
    } catch {
      setFormError("Something went wrong while renaming. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    const isBusy = isSaving || isRefreshing;

    return (
      <form className="w-full max-w-md space-y-3" onSubmit={handleSave}>
        {formError && (
          <div role="alert" className="tk-alert-error">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="workspace-name" className="tk-label">
            Workspace name
          </label>

          <input
            id="workspace-name"
            name="name"
            type="text"
            defaultValue={name}
            maxLength={50}
            autoFocus
            aria-invalid={Boolean(fieldError)}
            aria-describedby={
              fieldError ? "workspace-name-error" : "workspace-name-hint"
            }
            className="tk-input mt-2"
          />

          {fieldError ? (
            <p id="workspace-name-error" className="tk-field-error">
              {fieldError}
            </p>
          ) : (
            <p id="workspace-name-hint" className="tk-hint">
              Changing the name can change the workspace&apos;s web address.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={isBusy} className="tk-btn tk-btn-primary">
            {isBusy ? "Saving..." : "Save name"}
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
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="tk-page-title truncate">{name}</h1>
        <span className={`tk-badge ${isOwner ? "tk-badge-accent" : ""}`}>
          {isOwner ? "Owner" : "Member"}
        </span>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              setFieldError("");
              setFormError("");
              setNotice("");
              setIsEditing(true);
            }}
            className="tk-btn tk-btn-sm text-zinc-600 hover:bg-zinc-100"
            aria-label={`Rename ${name}`}
          >
            Rename
          </button>
        )}
      </div>
      <p className="mt-1 truncate text-sm text-zinc-500">/{workspaceSlug}</p>

      {notice && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}
    </div>
  );
}
