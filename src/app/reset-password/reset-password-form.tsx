"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { formatWait } from "@/lib/format-wait";
import { clearUrlFragment, useFragmentToken } from "@/lib/url-fragment";

type ResetPasswordFormProps = {
  lifetimeMinutes: number;
};

type Status = "ready" | "submitting" | "done" | "invalid" | "error";

type FieldErrors = {
  password?: string[];
  confirmPassword?: string[];
};

// Mirrors the server's rules so most mistakes are caught before a request.
// bcrypt only reads the first 72 bytes, and characters outside ASCII take more
// than one byte each.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function validatePasswords(password: string, confirmPassword: string) {
  const errors: FieldErrors = {};

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = ["Password must be at least 8 characters."];
  } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    errors.password = [
      "Password must be 72 characters or fewer. Some characters, such as emoji, count as more than one.",
    ];
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = ["Passwords do not match."];
  }

  return errors;
}

function LoginFooter() {
  return (
    <div className="mt-8 text-center text-sm text-zinc-600">
      Remembered your password?{" "}
      <Link href="/login" className="tk-link">
        Log in
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ lifetimeMinutes }: ResetPasswordFormProps) {
  const token = useFragmentToken();
  const [status, setStatus] = useState<Status>("ready");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);

    const firstInvalid = errors.password ? "password" : "confirmPassword";
    const input = formRef.current?.elements.namedItem(firstInvalid);

    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current || secondsLeft > 0 || !token) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    const errors = validatePasswords(password, confirmPassword);
    setErrorMessage("");

    if (errors.password || errors.confirmPassword) {
      showFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    inFlight.current = true;
    setStatus("submitting");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStatus("done");
        clearUrlFragment();
        return;
      }

      if (data.error === "INVALID_OR_EXPIRED_TOKEN") {
        setStatus("invalid");
        clearUrlFragment();
        return;
      }

      if (
        data.error === "VALIDATION_ERROR" &&
        (data.fields?.password || data.fields?.confirmPassword)
      ) {
        setStatus("ready");
        showFieldErrors(data.fields);
        return;
      }

      const retryAfter =
        Number(response.headers.get("Retry-After")) ||
        Number(data.retryAfterSeconds) ||
        0;

      if (retryAfter > 0) {
        setSecondsLeft(retryAfter);
      }

      setErrorMessage(
        response.status === 429
          ? `Too many attempts. Try again in about ${formatWait(Math.max(retryAfter, 1))}.`
          : (data.message ??
              "We couldn't reset your password. Please try again."),
      );
      setStatus("error");
    } catch {
      setErrorMessage(
        "Something went wrong while resetting your password. Check your connection and try again.",
      );
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  // A final outcome only applies while its token is cleared from the URL. A
  // new link opened in the same tab brings back the form.
  const hasOutcome = !token && (status === "done" || status === "invalid");

  if (hasOutcome && status === "done") {
    return (
      <div className="space-y-6">
        <div role="status" className="tk-alert-success">
          <p className="font-medium">Your password has been reset.</p>
          <p className="mt-1">
            For your security, we signed you out on every device, including
            this one. Log in with your new password to continue.
          </p>
        </div>

        <Link href="/login" className="tk-btn tk-btn-primary tk-btn-lg w-full">
          Log in
        </Link>
      </div>
    );
  }

  if (hasOutcome && status === "invalid") {
    return (
      <>
        <div className="space-y-6">
          <p role="alert" className="tk-alert-error">
            This password reset link is invalid or has expired. Links expire
            after {lifetimeMinutes} minutes, can only be used once, and stop
            working when a newer one is requested.
          </p>

          <Link
            href="/forgot-password"
            className="tk-btn tk-btn-primary tk-btn-lg w-full"
          >
            Request a new link
          </Link>
        </div>
        <LoginFooter />
      </>
    );
  }

  if (token === undefined) {
    return (
      <>
        <div role="status" className="space-y-4">
          <span className="sr-only">Checking your password reset link...</span>
          <div aria-hidden="true" className="tk-skeleton h-10 w-full" />
          <div aria-hidden="true" className="tk-skeleton h-10 w-full" />
          <div aria-hidden="true" className="tk-skeleton h-10 w-full" />
        </div>
        <LoginFooter />
      </>
    );
  }

  if (!token) {
    return (
      <>
        <div className="space-y-6">
          <p role="alert" className="tk-alert-error">
            This link is incomplete. Open the link from your password reset
            email again, or request a new one.
          </p>

          <Link
            href="/forgot-password"
            className="tk-btn tk-btn-primary tk-btn-lg w-full"
          >
            Request a new link
          </Link>
        </div>
        <LoginFooter />
      </>
    );
  }

  const isSubmitting = status === "submitting";
  const isCoolingDown = secondsLeft > 0;

  let buttonLabel = "Reset password";

  if (isSubmitting) {
    buttonLabel = "Resetting password...";
  } else if (isCoolingDown) {
    buttonLabel = `Try again in ${formatWait(secondsLeft)}`;
  }

  return (
    <>
      <form
        ref={formRef}
        method="post"
        className="space-y-5"
        onSubmit={handleSubmit}
        noValidate
      >
        {status === "error" && (
          <div role="alert" className="tk-alert-error">
            {errorMessage}
          </div>
        )}

        <div>
          <label htmlFor="password" className="tk-label">
            New password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a new password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : "password-hint"
            }
            className="tk-input mt-2"
          />

          {fieldErrors.password?.[0] ? (
            <p id="password-error" className="tk-field-error">
              {fieldErrors.password[0]}
            </p>
          ) : (
            <p id="password-hint" className="tk-hint">
              Use at least 8 characters.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="tk-label">
            Confirm new password
          </label>

          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your new password again"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? "confirmPassword-error" : undefined
            }
            className="tk-input mt-2"
          />

          {fieldErrors.confirmPassword?.[0] && (
            <p id="confirmPassword-error" className="tk-field-error">
              {fieldErrors.confirmPassword[0]}
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
      <LoginFooter />
    </>
  );
}
