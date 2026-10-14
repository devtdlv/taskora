"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { verifyEmailPath } from "@/lib/verify-email-path";

type FieldErrors = {
  name?: string[];
  description?: string[];
};

type ProjectHeaderProps = {
  workspaceSlug: string;
  projectSlug: string;
  name: string;
  description: string | null;
  // ISO timestamp, or null while the project is active.
  archivedAt: string | null;
  showCreateTask: boolean;
};

export function ProjectHeader({
  workspaceSlug,
  projectSlug,
  name,
  description,
  archivedAt,
  showCreateTask,
}: ProjectHeaderProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  const projectHref = `/workspaces/${workspaceSlug}/projects/${projectSlug}`;

  // Returns the parsed response, or null when the user was sent elsewhere.
  async function send(path: string, init: RequestInit) {
    const response = await fetch(`/api${projectHref}${path}`, init);

    if (response.status === 401) {
      router.push("/login");
      return null;
    }

    const data =
      response.status === 204 ? {} : await response.json().catch(() => ({}));

    if (data.error === "EMAIL_NOT_VERIFIED") {
      router.push(verifyEmailPath(window.location.pathname));
      return null;
    }

    return { ok: response.ok, data };
  }

  function startEditing() {
    setFieldErrors({});
    setFormError("");
    setNotice("");
    setIsEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await send("", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description"),
        }),
      });

      if (!result) {
        return;
      }

      if (!result.ok) {
        if (result.data.error === "VALIDATION_ERROR") {
          setFieldErrors(result.data.fields ?? {});
          return;
        }

        setFormError(result.data.message ?? "Unable to save the project.");
        return;
      }

      const newSlug: string = result.data.project.slug;

      startTransition(() => {
        setIsEditing(false);
        setNotice("Project updated.");

        // A new name can mean a new slug, and the old URL stops working.
        if (newSlug !== projectSlug) {
          router.replace(`/workspaces/${workspaceSlug}/projects/${newSlug}`);
        } else {
          router.refresh();
        }
      });
    } catch {
      setFormError("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    setArchiveError("");
    setIsArchiving(true);

    try {
      const result = await send("/archive", { method: "POST" });

      if (!result) {
        return;
      }

      if (!result.ok) {
        setArchiveError(result.data.message ?? "Unable to archive the project.");
        return;
      }

      startTransition(() => {
        setIsArchiveOpen(false);
        setNotice("");
        router.refresh();
      });
    } catch {
      setArchiveError(
        "Something went wrong while archiving. Please try again.",
      );
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    setRestoreError("");
    setIsRestoring(true);

    try {
      const result = await send("/archive", { method: "DELETE" });

      if (!result) {
        return;
      }

      if (!result.ok) {
        setRestoreError(result.data.message ?? "Unable to restore the project.");
        return;
      }

      startTransition(() => {
        setNotice("Project restored. You can make changes again.");
        router.refresh();
      });
    } catch {
      setRestoreError("Something went wrong while restoring. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  if (isEditing) {
    const isBusy = isSaving || isRefreshing;

    return (
      <form
        className="tk-card mt-4 space-y-5 p-5 sm:p-8"
        onSubmit={handleSave}
        aria-labelledby="edit-project-heading"
      >
        <h1 id="edit-project-heading" className="tk-section-title">
          Edit project
        </h1>

        {formError && (
          <div role="alert" className="tk-alert-error">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="project-name" className="tk-label">
            Project name
          </label>

          <input
            id="project-name"
            name="name"
            type="text"
            defaultValue={name}
            maxLength={80}
            autoFocus
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? "project-name-error" : "project-name-hint"
            }
            className="tk-input mt-2"
          />

          {fieldErrors.name?.[0] ? (
            <p id="project-name-error" className="tk-field-error">
              {fieldErrors.name[0]}
            </p>
          ) : (
            <p id="project-name-hint" className="tk-hint">
              Changing the name can change the project&apos;s web address.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-description" className="tk-label">
            Description{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>

          <textarea
            id="project-description"
            name="description"
            rows={4}
            defaultValue={description ?? ""}
            maxLength={500}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={
              fieldErrors.description ? "project-description-error" : undefined
            }
            className="tk-input tk-textarea mt-2"
          />

          {fieldErrors.description?.[0] && (
            <p id="project-description-error" className="tk-field-error">
              {fieldErrors.description[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={isBusy} className="tk-btn tk-btn-primary">
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
    <>
      {archivedAt && (
        <div
          role="status"
          className="tk-alert-warning mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-semibold">Archived project.</span> It&apos;s
            read-only: tasks and comments can&apos;t be changed until it&apos;s
            restored. Archived{" "}
            <time dateTime={archivedAt} suppressHydrationWarning>
              {new Date(archivedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </time>
            .
          </p>

          <button
            type="button"
            onClick={handleRestore}
            disabled={isRestoring || isRefreshing}
            className="tk-btn tk-btn-secondary tk-btn-sm shrink-0"
          >
            {isRestoring ? "Restoring..." : "Restore project"}
          </button>
        </div>
      )}

      {restoreError && (
        <div role="alert" className="tk-alert-error mt-4">
          {restoreError}
        </div>
      )}

      {notice && (
        <div role="status" className="tk-alert-success mt-4">
          {notice}
        </div>
      )}

      <div className="tk-page-header mt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="tk-page-title break-words">{name}</h1>
            {archivedAt && <span className="tk-badge">Archived</span>}
          </div>

          {description && (
            <p className="tk-page-description whitespace-pre-line">
              {description}
            </p>
          )}
        </div>

        {!archivedAt && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={startEditing}
              className="tk-btn tk-btn-secondary"
            >
              Edit project
            </button>

            <button
              type="button"
              onClick={() => {
                setArchiveError("");
                setIsArchiveOpen(true);
              }}
              className="tk-btn tk-btn-secondary"
            >
              Archive
            </button>

            {showCreateTask && (
              <Link href={`${projectHref}/tasks/new`} className="tk-btn tk-btn-primary">
                Create task
              </Link>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isArchiveOpen}
        title={`Archive ${name}?`}
        confirmLabel="Archive project"
        pendingLabel="Archiving..."
        isPending={isArchiving || isRefreshing}
        error={archiveError}
        onConfirm={handleArchive}
        onCancel={() => setIsArchiveOpen(false)}
      >
        <p>
          The project moves to Archived projects and becomes read-only. Its
          tasks and comments are kept, and anyone in the workspace can restore
          it later.
        </p>
      </ConfirmDialog>
    </>
  );
}
