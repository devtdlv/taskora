"use client";

import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// A native modal dialog, so focus is trapped inside it, Escape closes it, and
// focus returns to the button that opened it. Cancel gets initial focus so a
// stray Enter never confirms a destructive action.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();

        if (!isPending) {
          onCancel();
        }
      }}
      onClick={(event) => {
        // Only the backdrop is outside the inner panel.
        if (event.target === event.currentTarget && !isPending) {
          onCancel();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-zinc-950/40"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="tk-section-title">
            {title}
          </h2>

          <div
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-ink-secondary"
          >
            {children}
          </div>

          {error && (
            <div role="alert" className="tk-alert-error mt-4">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              disabled={isPending}
              className="tk-btn tk-btn-secondary"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="tk-btn tk-btn-danger"
            >
              {isPending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
