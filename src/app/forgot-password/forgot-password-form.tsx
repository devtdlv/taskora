"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { formatWait } from "@/lib/format-wait";

type ForgotPasswordFormProps = {
  lifetimeMinutes: number;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

// Only countdowns this short are shown on the button. Longer waits are
// explained in the message instead.
const MAX_COUNTDOWN_SECONDS = 120;

export function ForgotPasswordForm({ lifetimeMinutes }: ForgotPasswordFormProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [emailError, setEmailError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inFlight = useRef(false);
  const sentNotice = useRef<HTMLDivElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (status.kind === "sent") {
      sentNotice.current?.focus();
    }
  }, [status.kind]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current || secondsLeft > 0) {
      return;
    }

    const email = String(new FormData(event.currentTarget).get("email") ?? "");

    inFlight.current = true;
    setStatus({ kind: "submitting" });
    setEmailError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      // The API answers the same way whether or not the account exists, so
      // the message never says an email was sent.
      if (response.ok) {
        setStatus({ kind: "sent", email: email.trim() });
        return;
      }

      if (data.error === "VALIDATION_ERROR") {
        setEmailError(data.fields?.email?.[0] ?? "Enter a valid email address.");
        setStatus({ kind: "idle" });
        emailInput.current?.focus();
        return;
      }

      const retryAfter =
        Number(response.headers.get("Retry-After")) ||
        Number(data.retryAfterSeconds) ||
        0;

      if (retryAfter > 0) {
        setSecondsLeft(retryAfter);
      }

      if (response.status === 429) {
        setStatus({
          kind: "error",
          message:
            retryAfter > 0
              ? `Too many reset requests. Try again in about ${formatWait(retryAfter)}.`
              : "Too many reset requests. Please wait before trying again.",
        });
        return;
      }

      setStatus({
        kind: "error",
        message:
          data.message ??
          "We couldn't process your request. Please try again later.",
      });
    } catch {
      setStatus({
        kind: "error",
        message:
          "Something went wrong while sending your request. Check your connection and try again.",
      });
    } finally {
      inFlight.current = false;
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="space-y-6">
        <div
          ref={sentNotice}
          role="status"
          tabIndex={-1}
          className="tk-alert-success outline-none"
        >
          <p className="font-medium">Check your email</p>
          <p className="mt-1">
            If an account exists for{" "}
            <span className="font-medium break-all">{status.email}</span>,
            you&apos;ll receive a link to reset your password. The link
            expires in {lifetimeMinutes} minutes.
          </p>
        </div>

        <p className="text-sm leading-6 text-zinc-600">
          Didn&apos;t get an email? Check your spam folder, make sure you
          entered the address you signed up with, or try again in a few
          minutes.
        </p>

        <div className="space-y-3">
          <Link href="/login" className="tk-btn tk-btn-primary tk-btn-lg w-full">
            Back to log in
          </Link>

          <button
            type="button"
            onClick={() => setStatus({ kind: "idle" })}
            className="tk-btn tk-btn-secondary tk-btn-lg w-full"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  const isSubmitting = status.kind === "submitting";
  const isCoolingDown = secondsLeft > 0;

  let buttonLabel = "Send reset link";

  if (isSubmitting) {
    buttonLabel = "Sending link...";
  } else if (isCoolingDown) {
    buttonLabel =
      secondsLeft <= MAX_COUNTDOWN_SECONDS
        ? `Try again in ${secondsLeft}s`
        : "Try again later";
  }

  return (
    <form method="post" className="space-y-5" onSubmit={handleSubmit}>
      {status.kind === "error" && (
        <div role="alert" className="tk-alert-error">
          {status.message}
        </div>
      )}

      <div>
        <label htmlFor="email" className="tk-label">
          Email address
        </label>

        <input
          ref={emailInput}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          className="tk-input mt-2"
        />

        {emailError && (
          <p id="email-error" className="tk-field-error">
            {emailError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isCoolingDown}
        aria-busy={isSubmitting}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
