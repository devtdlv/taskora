"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { formatWait } from "@/lib/format-wait";

type ResendVerificationProps = {
  email: string;
  initialNotice: "sent" | "failed" | null;
  cooldownSeconds: number;
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

// Only countdowns this short are shown on the button. Longer waits, such as
// the daily limit, are explained in the message instead.
const MAX_COUNTDOWN_SECONDS = 120;

export function ResendVerification({
  email,
  initialNotice,
  cooldownSeconds,
}: ResendVerificationProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(
    initialNotice === "sent" ? cooldownSeconds : 0,
  );
  const inFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleResend() {
    if (inFlight.current || secondsLeft > 0) {
      return;
    }

    inFlight.current = true;
    setStatus({ kind: "sending" });

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (data.status === "already-verified") {
          // The page redirects verified users onward.
          router.refresh();
          return;
        }

        setStatus({ kind: "sent" });
        setSecondsLeft(cooldownSeconds);
        return;
      }

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/verify-email")}`);
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
        setStatus(
          retryAfter > MAX_COUNTDOWN_SECONDS
            ? {
                kind: "error",
                message: `You've requested the maximum number of verification emails for now. Try again in about ${formatWait(retryAfter)}.`,
              }
            : { kind: "waiting" },
        );
        return;
      }

      setStatus({
        kind: "error",
        message:
          data.message ??
          "We couldn't send the verification email. Please try again later.",
      });
    } catch {
      setStatus({
        kind: "error",
        message:
          "Something went wrong while sending the email. Check your connection and try again.",
      });
    } finally {
      inFlight.current = false;
    }
  }

  const isSending = status.kind === "sending";
  const isCoolingDown = secondsLeft > 0;

  let buttonLabel = "Resend verification email";

  if (isSending) {
    buttonLabel = "Sending...";
  } else if (isCoolingDown) {
    buttonLabel =
      secondsLeft <= MAX_COUNTDOWN_SECONDS
        ? `Resend available in ${secondsLeft}s`
        : "Resend unavailable for now";
  }

  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite">
        {status.kind === "idle" && initialNotice === "sent" && (
          <p className="tk-alert-success">
            We sent a verification link to{" "}
            <span className="font-medium break-all">{email}</span>. Open it to
            confirm your email address.
          </p>
        )}

        {status.kind === "idle" && initialNotice === "failed" && (
          <p className="tk-alert-warning">
            Your account was created, but we couldn&apos;t send the
            verification email. Use the button below to try again.
          </p>
        )}

        {status.kind === "sent" && (
          <p className="tk-alert-success">
            We sent a new verification link to{" "}
            <span className="font-medium break-all">{email}</span>. Any earlier
            links no longer work.
          </p>
        )}

        {status.kind === "waiting" && (
          <p className="tk-alert-warning">
            Please wait a moment before requesting another email.
          </p>
        )}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="tk-alert-error">
          {status.message}
        </p>
      )}

      <button
        type="button"
        onClick={handleResend}
        disabled={isSending || isCoolingDown}
        aria-busy={isSending}
        className="tk-btn tk-btn-primary tk-btn-lg w-full"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
