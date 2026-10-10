"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AcceptInvitationButtonProps = {
  token: string;
};

export function AcceptInvitationButton({ token }: AcceptInvitationButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAccept() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to accept the invitation.");
        return;
      }

      router.push(`/workspaces/${data.workspace.slug}`);
    } catch {
      setError("Something went wrong while accepting the invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="tk-alert-error">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleAccept}
        disabled={isSubmitting}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {isSubmitting ? "Joining..." : "Accept invitation"}
      </button>
    </div>
  );
}
