"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AuthShell } from "@/components/auth-shell";

type FieldErrors = {
  email?: string[];
  password?: string[];
};

type LoginFormProps = {
  redirectPath: string;
};

export function LoginForm({ redirectPath }: LoginFormProps) {
  const nextQuery =
    redirectPath === "/dashboard"
      ? ""
      : `?next=${encodeURIComponent(redirectPath)}`;

  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
      remember: formData.get("remember") === "on",
    };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "VALIDATION_ERROR") {
          setFieldErrors(data.fields ?? {});
          return;
        }

        setFormError(data.message ?? "Unable to log you in.");
        return;
      }

      router.push(redirectPath);
    } catch {
      setFormError("Something went wrong while logging in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Enter your details to continue to your workspace."
      footer={
        <>
          New to Taskora?{" "}
          <Link href={`/signup${nextQuery}`} className="tk-link">
            Create an account
          </Link>
        </>
      }
    >
      <form method="post" className="space-y-5" onSubmit={handleSubmit}>
        {formError && (
          <div role="alert" className="tk-alert-error">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="email" className="tk-label">
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="tk-input mt-2"
          />

          {fieldErrors.email?.[0] && (
            <p id="email-error" className="tk-field-error">
              {fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="password" className="tk-label">
              Password
            </label>

            <Link href="/forgot-password" className="tk-link text-sm">
              Forgot password?
            </Link>
          </div>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            className="tk-input mt-2"
          />

          {fieldErrors.password?.[0] && (
            <p id="password-error" className="tk-field-error">
              {fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            className="tk-checkbox"
          />

          <label htmlFor="remember" className="text-sm text-zinc-600">
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tk-btn tk-btn-primary tk-btn-lg w-full"
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
