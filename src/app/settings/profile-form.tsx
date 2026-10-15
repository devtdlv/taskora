"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";

import { verifyEmailPath } from "@/lib/verify-email-path";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    setFieldError("");
    setFormError("");
    setNotice("");

    if (value.trim().length < 2) {
      setFieldError("Name must be at least 2 characters.");
      return;
    }

    inFlight.current = true;
    setIsSaving(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: value }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.error === "EMAIL_NOT_VERIFIED") {
          router.push(verifyEmailPath(window.location.pathname));
          return;
        }

        if (data.error === "VALIDATION_ERROR") {
          setFieldError(data.fields?.name?.[0] ?? "Enter a valid name.");
          return;
        }

        setFormError(data.message ?? "Unable to update your name.");
        return;
      }

      setValue(data.user.name);
      setNotice("Your name has been updated.");

      // The navigation shows the name too.
      startTransition(() => router.refresh());
    } catch {
      setFormError("Something went wrong while saving. Please try again.");
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }

  const isBusy = isSaving || isRefreshing;

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div role="alert" className="tk-alert-error">
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="profile-name" className="tk-label">
          Name
        </label>

        <input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? "profile-name-error" : undefined}
          className="tk-input mt-2"
        />

        {fieldError && (
          <p id="profile-name-error" className="tk-field-error">
            {fieldError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isBusy}
          aria-busy={isSaving}
          className="tk-btn tk-btn-primary w-full sm:w-auto"
        >
          {isSaving ? "Saving..." : "Save name"}
        </button>

        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      </div>
    </form>
  );
}
