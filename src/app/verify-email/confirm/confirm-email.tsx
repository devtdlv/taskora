"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { clearUrlFragment, useFragmentToken } from "@/lib/url-fragment";

type ConfirmEmailProps = {
  isSignedIn: boolean;
  lifetimeHours: number;
};

type Status = "ready" | "verifying" | "verified" | "invalid" | "error";

export function ConfirmEmail({ isSignedIn, lifetimeHours }: ConfirmEmailProps) {
  const token = useFragmentToken();
  const [status, setStatus] = useState<Status>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const inFlight = useRef(false);

  const requestNewLink = isSignedIn
    ? "/verify-email"
    : `/login?next=${encodeURIComponent("/verify-email")}`;

  async function handleConfirm() {
    if (inFlight.current || !token) {
      return;
    }

    inFlight.current = true;
    setStatus("verifying");
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStatus("verified");
        clearUrlFragment();
        return;
      }

      if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
        setStatus("invalid");
        clearUrlFragment();
        return;
      }

      setErrorMessage(
        data.message ?? "We couldn't verify your email. Please try again.",
      );
      setStatus("error");
    } catch {
      setErrorMessage(
        "Something went wrong while verifying your email. Check your connection and try again.",
      );
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  // A final outcome only applies while its token is cleared from the URL. A
  // new link opened in the same tab brings back the confirm step.
  const hasOutcome = !token && (status === "verified" || status === "invalid");

  if (hasOutcome && status === "verified") {
    return (
      <div className="space-y-6">
        <p role="status" className="tk-alert-success">
          Your email address is verified. Thanks for confirming it.
        </p>

        <Link
          href={isSignedIn ? "/dashboard" : "/login"}
          className="tk-btn tk-btn-primary tk-btn-lg w-full"
        >
          {isSignedIn ? "Continue to Taskora" : "Log in to Taskora"}
        </Link>
      </div>
    );
  }

  if (hasOutcome && status === "invalid") {
    return (
      <div className="space-y-6">
        <p role="alert" className="tk-alert-error">
          This verification link is invalid or has expired. Links expire after{" "}
          {lifetimeHours} hours, can only be used once, and stop working when a
          newer one is sent.
        </p>

        <Link
          href={requestNewLink}
          className="tk-btn tk-btn-primary tk-btn-lg w-full"
        >
          {isSignedIn ? "Request a new link" : "Log in to request a new link"}
        </Link>
      </div>
    );
  }

  if (token === undefined) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Checking your verification link...</span>
        <div aria-hidden="true" className="tk-skeleton h-4 w-3/4" />
        <div aria-hidden="true" className="tk-skeleton h-10 w-full" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <p role="alert" className="tk-alert-error">
          This link is incomplete. Open the link from your verification email
          again, or request a new one.
        </p>

        <Link
          href={requestNewLink}
          className="tk-btn tk-btn-primary tk-btn-lg w-full"
        >
          {isSignedIn ? "Request a new link" : "Log in to request a new link"}
        </Link>
      </div>
    );
  }

  const isVerifying = status === "verifying";

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-zinc-600">
        Select the button below to confirm that this email address belongs to
        you.
      </p>

      {status === "error" && (
        <p role="alert" className="tk-alert-error">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isVerifying}
        aria-busy={isVerifying}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {isVerifying
          ? "Confirming..."
          : status === "error"
            ? "Try again"
            : "Confirm email address"}
      </button>
    </div>
  );
}
