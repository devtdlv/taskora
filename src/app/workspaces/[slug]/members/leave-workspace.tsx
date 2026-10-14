"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { verifyEmailPath } from "@/lib/verify-email-path";

type LeaveWorkspaceProps = {
  workspaceSlug: string;
  workspaceName: string;
  isLastOwner: boolean;
};

export function LeaveWorkspace({
  workspaceSlug,
  workspaceName,
  isLastOwner,
}: LeaveWorkspaceProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  async function handleLeave() {
    setDialogError("");
    setIsLeaving(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/membership`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(verifyEmailPath(window.location.pathname));
          return;
        }

        // NOT_FOUND means the membership is already gone, for example after
        // being removed by an owner, so the result is the same as leaving.
        if (data.error !== "NOT_FOUND") {
          setDialogError(data.message ?? "Unable to leave the workspace.");
          setIsLeaving(false);
          return;
        }
      }

      // Left in the leaving state: this page is no longer accessible, so the
      // dialog stays disabled until the dashboard replaces it.
      router.replace("/dashboard");
    } catch {
      setDialogError(
        "Something went wrong while leaving the workspace. Please try again.",
      );
      setIsLeaving(false);
    }
  }

  return (
    <section
      aria-labelledby="leave-heading"
      className="tk-card mt-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0">
        <h2 id="leave-heading" className="tk-section-title">
          Leave workspace
        </h2>
        <p id="leave-description" className="mt-1 text-sm leading-6 text-zinc-600">
          {isLastOwner
            ? `You're the only owner of ${workspaceName}. A workspace always needs an owner, so you can't leave it.`
            : `You'll lose access to ${workspaceName} and its projects right away.`}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setDialogError("");
          setIsOpen(true);
        }}
        disabled={isLastOwner}
        aria-describedby="leave-description"
        className="tk-btn tk-btn-danger shrink-0"
      >
        Leave workspace
      </button>

      <ConfirmDialog
        open={isOpen}
        title={`Leave ${workspaceName}?`}
        confirmLabel="Leave workspace"
        pendingLabel="Leaving..."
        isPending={isLeaving}
        error={dialogError}
        onConfirm={handleLeave}
        onCancel={() => setIsOpen(false)}
      >
        <p>
          You&apos;ll lose access to its projects, tasks, and comments
          immediately. To come back, an owner will need to invite you again.
        </p>
      </ConfirmDialog>
    </section>
  );
}
