"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { verifyEmailPath } from "@/lib/verify-email-path";

type PendingInvitation = {
  id: string;
  email: string;
  expiresAt: string;
  isExpired: boolean;
};

type NewLink = {
  invitationId: string;
  url: string;
};

type PendingInvitationsProps = {
  workspaceSlug: string;
  invitations: PendingInvitation[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Only a hash of each token is stored, so an existing link can't be shown
// again. "New link" re-invites the same email, which replaces the token and
// stops the previous link from working.
export function PendingInvitations({
  workspaceSlug,
  invitations,
}: PendingInvitationsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<PendingInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<NewLink | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [copyMessage, setCopyMessage] = useState("");

  // Returns the parsed response, or null when the user was sent elsewhere.
  async function send(path: string, init: RequestInit) {
    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/invitations${path}`,
      init,
    );

    if (response.status === 401) {
      router.push("/login");
      return null;
    }

    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));

    if (data.error === "EMAIL_NOT_VERIFIED") {
      router.push(verifyEmailPath(window.location.pathname));
      return null;
    }

    return { ok: response.ok, data };
  }

  function resetMessages() {
    setNotice("");
    setRowError(null);
    setCopyMessage("");
  }

  async function handleRevoke() {
    if (!target) {
      return;
    }

    setDialogError("");
    setIsRevoking(true);

    try {
      const result = await send(`/${target.id}`, { method: "DELETE" });

      if (!result) {
        return;
      }

      // Not pending any more means it was already revoked or accepted, so
      // there's nothing left to revoke either way.
      if (!result.ok && result.data.error !== "INVITATION_NOT_FOUND") {
        setDialogError(result.data.message ?? "Unable to revoke the invitation.");
        setIsRevoking(false);
        return;
      }

      setNotice(
        result.ok
          ? `The invitation for ${target.email} was revoked. Its link no longer works.`
          : `The invitation for ${target.email} is no longer pending.`,
      );

      if (newLink?.invitationId === target.id) {
        setNewLink(null);
      }

      setTarget(null);
      setIsRevoking(false);
      startTransition(() => router.refresh());
    } catch {
      setDialogError(
        "Something went wrong while revoking the invitation. Please try again.",
      );
      setIsRevoking(false);
    }
  }

  async function handleNewLink(invitation: PendingInvitation) {
    resetMessages();
    setNewLink(null);
    setRenewingId(invitation.id);

    try {
      const result = await send("", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: invitation.email }),
      });

      if (!result) {
        return;
      }

      if (!result.ok) {
        setRowError({
          id: invitation.id,
          message: result.data.message ?? "Unable to create a new link.",
        });

        if (result.data.error === "ALREADY_MEMBER") {
          startTransition(() => router.refresh());
        }

        return;
      }

      setNewLink({ invitationId: invitation.id, url: result.data.invitation.url });
      startTransition(() => router.refresh());
    } catch {
      setRowError({
        id: invitation.id,
        message: "Something went wrong while creating a new link. Please try again.",
      });
    } finally {
      setRenewingId(null);
    }
  }

  async function handleCopy() {
    if (!newLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(newLink.url);
      setCopyMessage("Link copied.");
    } catch {
      // The Clipboard API is only available on HTTPS or localhost.
      linkInputRef.current?.select();
      setCopyMessage("Press Ctrl+C to copy the selected link.");
    }
  }

  return (
    <>
      <div role="status">
        {notice && <p className="tk-alert-success mt-4">{notice}</p>}
      </div>

      {invitations.length === 0 ? (
        <div className="tk-empty mt-4 py-10">
          <p className="text-sm font-medium text-ink">No pending invitations</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-600">
            Invitations you create appear here until they&apos;re accepted or
            revoked.
          </p>
        </div>
      ) : (
        <ul className="tk-card mt-4 divide-y divide-zinc-200 overflow-hidden">
          {invitations.map((invitation) => {
            const isRenewing = renewingId === invitation.id;
            const error = rowError?.id === invitation.id ? rowError.message : "";
            const link = newLink?.invitationId === invitation.id ? newLink : null;

            return (
              <li key={invitation.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="truncate">{invitation.email}</span>
                      {invitation.isExpired && (
                        <span className="tk-badge shrink-0 bg-amber-50 text-amber-800">
                          Expired
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {invitation.isExpired ? "Expired " : "Expires "}
                      <time dateTime={invitation.expiresAt} suppressHydrationWarning>
                        {formatDate(invitation.expiresAt)}
                      </time>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNewLink(invitation)}
                      disabled={renewingId !== null}
                      aria-label={`New link for ${invitation.email}`}
                      className="tk-btn tk-btn-secondary tk-btn-sm"
                    >
                      {isRenewing ? "Creating..." : "New link"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        resetMessages();
                        setDialogError("");
                        setTarget(invitation);
                      }}
                      disabled={isRenewing}
                      aria-label={`Revoke the invitation for ${invitation.email}`}
                      className="tk-btn tk-btn-sm text-red-700 hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="tk-field-error">
                    {error}
                  </p>
                )}

                {link && (
                  <div
                    role="status"
                    className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800"
                  >
                    <p>
                      New link created. The previous link for {invitation.email}{" "}
                      no longer works.
                    </p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        ref={linkInputRef}
                        readOnly
                        value={link.url}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label={`New invitation link for ${invitation.email}`}
                        className="tk-input"
                      />

                      <button
                        type="button"
                        onClick={handleCopy}
                        className="tk-btn tk-btn-secondary tk-btn-lg"
                      >
                        Copy link
                      </button>
                    </div>

                    {copyMessage && (
                      <p className="mt-2 text-xs text-green-700">{copyMessage}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Revoke invitation?"
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking..."
        isPending={isRevoking}
        error={dialogError}
        onConfirm={handleRevoke}
        onCancel={() => setTarget(null)}
      >
        {target && (
          <p>
            The invitation link sent to{" "}
            <strong className="font-medium text-ink">{target.email}</strong>{" "}
            will stop working immediately. You can invite them again later.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
