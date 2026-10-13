"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { verifyEmailPath } from "@/lib/verify-email-path";

type CreatedInvitation = {
  email: string;
  expiresAt: string;
  url: string;
};

type InviteMemberFormProps = {
  workspaceSlug: string;
};

export function InviteMemberForm({ workspaceSlug }: InviteMemberFormProps) {
  const router = useRouter();
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setEmailError("");
    setFormError("");
    setInvitation(null);
    setCopyMessage("");
    setIsSubmitting(true);

    const formData = new FormData(form);

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.get("email") }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "VALIDATION_ERROR") {
          setEmailError(data.fields?.email?.[0] ?? "Enter a valid email address.");
          return;
        }

        if (data.error === "ALREADY_MEMBER") {
          setEmailError(data.message);
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

        setFormError(data.message ?? "Unable to create the invitation.");
        return;
      }

      form.reset();
      setInvitation(data.invitation);
    } catch {
      setFormError(
        "Something went wrong while creating the invitation. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!invitation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopyMessage("Link copied.");
    } catch {
      // The Clipboard API is only available on HTTPS or localhost.
      linkInputRef.current?.select();
      setCopyMessage("Press Ctrl+C to copy the selected link.");
    }
  }

  return (
    <div className="space-y-5">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={handleSubmit}>
        <div className="flex-1">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="person@example.com"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined}
            className="tk-input"
          />

          {emailError && (
            <p id="email-error" className="tk-field-error">
              {emailError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tk-btn tk-btn-primary tk-btn-lg"
        >
          {isSubmitting ? "Creating..." : "Create invitation"}
        </button>
      </form>

      {formError && (
        <div role="alert" className="tk-alert-error">
          {formError}
        </div>
      )}

      {invitation && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800"
        >
          <p>
            Invitation created for {invitation.email}. Share this link with
            the person you&apos;re inviting.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              ref={linkInputRef}
              readOnly
              value={invitation.url}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Invitation link"
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

          <p className="mt-2 text-xs text-green-700">
            {copyMessage ||
              `The link can be used once and expires on ${new Date(
                invitation.expiresAt,
              ).toLocaleDateString()}.`}
          </p>
        </div>
      )}
    </div>
  );
}
