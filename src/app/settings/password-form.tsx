"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { formatWait } from "@/lib/format-wait";
import { verifyEmailPath } from "@/lib/verify-email-path";

type Field = "currentPassword" | "newPassword" | "confirmNewPassword";
type FieldErrors = Partial<Record<Field, string[]>>;

const FIELDS: Field[] = ["currentPassword", "newPassword", "confirmNewPassword"];

// Mirrors the server's rules so most mistakes are caught before a request.
// bcrypt only reads the first 72 bytes, and characters outside ASCII take more
// than one byte each.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function validate(values: Record<Field, string>) {
  const errors: FieldErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = ["Enter your current password."];
  }

  if (values.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = ["Password must be at least 8 characters."];
  } else if (new TextEncoder().encode(values.newPassword).length > MAX_PASSWORD_BYTES) {
    errors.newPassword = [
      "Password must be 72 characters or fewer. Some characters, such as emoji, count as more than one.",
    ];
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = ["Choose a password that's different from your current one."];
  }

  if (values.newPassword !== values.confirmNewPassword) {
    errors.confirmNewPassword = ["Passwords do not match."];
  }

  return errors;
}

function signedOutMessage(count: number) {
  if (count === 0) {
    return "Your password has been changed.";
  }

  return `Your password has been changed, and ${count} other ${
    count === 1 ? "session was" : "sessions were"
  } signed out.`;
}

export function PasswordForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);

    const firstInvalid = FIELDS.find((field) => errors[field]);
    const input = firstInvalid && formRef.current?.elements.namedItem(firstInvalid);

    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current || secondsLeft > 0) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(
      FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
    ) as Record<Field, string>;

    setFormError("");
    setNotice("");

    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    inFlight.current = true;
    setIsSaving(true);

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        form.reset();
        setNotice(signedOutMessage(data.signedOutSessions ?? 0));
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

      if (data.error === "VALIDATION_ERROR" || data.error === "INVALID_CURRENT_PASSWORD") {
        showFieldErrors(data.fields ?? {});
        return;
      }

      const retryAfter =
        Number(response.headers.get("Retry-After")) ||
        Number(data.retryAfterSeconds) ||
        0;

      if (retryAfter > 0) {
        setSecondsLeft(retryAfter);
      }

      setFormError(
        response.status === 429
          ? `Too many attempts. Try again in about ${formatWait(Math.max(retryAfter, 1))}.`
          : (data.message ?? "Unable to change your password. Please try again."),
      );
    } catch {
      setFormError("Something went wrong while changing your password. Please try again.");
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }

  const isCoolingDown = secondsLeft > 0;
  let buttonLabel = "Change password";

  if (isSaving) {
    buttonLabel = "Changing password...";
  } else if (isCoolingDown) {
    buttonLabel = `Try again in ${formatWait(secondsLeft)}`;
  }

  function passwordField(field: Field, label: string, autoComplete: string, hint?: string) {
    const error = fieldErrors[field]?.[0];
    const describedBy = error ? `${field}-error` : hint ? `${field}-hint` : undefined;

    return (
      <div>
        <label htmlFor={field} className="tk-label">
          {label}
        </label>

        <input
          id={field}
          name={field}
          type="password"
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="tk-input mt-2"
        />

        {error ? (
          <p id={`${field}-error`} className="tk-field-error">
            {error}
          </p>
        ) : (
          hint && (
            <p id={`${field}-hint`} className="tk-hint">
              {hint}
            </p>
          )
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div role="alert" className="tk-alert-error">
          {formError}
        </div>
      )}

      {notice && (
        <div role="status" className="tk-alert-success">
          {notice}
        </div>
      )}

      {passwordField("currentPassword", "Current password", "current-password")}
      {passwordField("newPassword", "New password", "new-password", "Use at least 8 characters.")}
      {passwordField("confirmNewPassword", "Confirm new password", "new-password")}

      <button
        type="submit"
        disabled={isSaving || isCoolingDown}
        aria-busy={isSaving}
        className="tk-btn tk-btn-primary w-full sm:w-auto"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
