"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import type { WorkspaceRole } from "@/generated/prisma/enums";
import { getInitials } from "@/lib/initials";
import { verifyEmailPath } from "@/lib/verify-email-path";

type Member = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  isCurrentUser: boolean;
};

type MembersListProps = {
  workspaceSlug: string;
  workspaceName: string;
  members: Member[];
  canRemove: boolean;
};

export function MembersList({
  workspaceSlug,
  workspaceName,
  members,
  canRemove,
}: MembersListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [target, setTarget] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");

  function openDialog(member: Member) {
    setNotice("");
    setDialogError("");
    setTarget(member);
  }

  async function handleRemove() {
    if (!target) {
      return;
    }

    setDialogError("");
    setIsRemoving(true);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/members/${target.id}`,
        { method: "DELETE" },
      );

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

        // Already removed, for example by another owner or a repeated
        // request, which is the outcome that was asked for.
        if (data.error !== "MEMBER_NOT_FOUND") {
          setDialogError(data.message ?? "Unable to remove this member.");
          setIsRemoving(false);
          return;
        }
      }

      setNotice(`${target.name} no longer has access to ${workspaceName}.`);
      setTarget(null);
      setIsRemoving(false);
      startTransition(() => router.refresh());
    } catch {
      setDialogError(
        "Something went wrong while removing the member. Please try again.",
      );
      setIsRemoving(false);
    }
  }

  return (
    <>
      {notice && (
        <p role="status" className="tk-alert-success mt-4">
          {notice}
        </p>
      )}

      <ul className="tk-card mt-4 divide-y divide-zinc-200 overflow-hidden">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700"
              >
                {getInitials(member.name)}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {member.name}
                  {member.isCurrentUser && (
                    <span className="ml-1.5 font-normal text-zinc-500">
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-zinc-500">
                  {member.email}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`tk-badge ${
                  member.role === "OWNER" ? "tk-badge-accent" : ""
                }`}
              >
                {member.role === "OWNER" ? "Owner" : "Member"}
              </span>

              {canRemove && !member.isCurrentUser && (
                <button
                  type="button"
                  onClick={() => openDialog(member)}
                  aria-label={`Remove ${member.name}`}
                  className="tk-btn tk-btn-sm text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        title="Remove member?"
        confirmLabel="Remove member"
        pendingLabel="Removing..."
        isPending={isRemoving}
        error={dialogError}
        onConfirm={handleRemove}
        onCancel={() => setTarget(null)}
      >
        {target && (
          <p>
            <strong className="font-medium text-ink">{target.name}</strong> (
            {target.email}) will lose access to {workspaceName} right away.
            Their comments stay, and tasks assigned to them become unassigned.
            You can invite them again later.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
