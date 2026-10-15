"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AuthShell } from "@/components/auth-shell";
import { showFieldErrors } from "@/lib/focus-invalid-field";

type FieldErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  confirmPassword?: string[];
  terms?: string[];
};

type SignupFormProps = {
  redirectPath: string;
};

export function SignupForm({ redirectPath }: SignupFormProps) {
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

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      terms: formData.get("terms") === "on",
    };

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "VALIDATION_ERROR") {
          showFieldErrors(form, () => setFieldErrors(data.fields ?? {}));
          return;
        }

        if (data.error === "EMAIL_ALREADY_EXISTS") {
          showFieldErrors(form, () =>
            setFieldErrors({
              email: ["An account with this email already exists."],
            }),
          );
          return;
        }

        setFormError(data.message ?? "Unable to create your account.");
        return;
      }

      const verifyParams = new URLSearchParams({
        delivery: data.verificationEmail === "sent" ? "sent" : "failed",
      });

      if (redirectPath !== "/dashboard") {
        verifyParams.set("next", redirectPath);
      }

      router.push(`/verify-email?${verifyParams}`);
    } catch {
      setFormError(
        "Something went wrong while creating your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Create your Taskora account and start organizing your team's work."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login${nextQuery}`} className="tk-link">
            Log in
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
          <label htmlFor="name" className="tk-label">
            Full name
          </label>

          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            className="tk-input mt-2"
          />

          {fieldErrors.name?.[0] && (
            <p id="name-error" className="tk-field-error">
              {fieldErrors.name[0]}
            </p>
          )}
        </div>

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
          <label htmlFor="password" className="tk-label">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
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
            Confirm password
          </label>

          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password again"
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

        <div>
          <div className="flex items-start gap-3">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              aria-invalid={Boolean(fieldErrors.terms)}
              aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
              className="tk-checkbox mt-0.5"
            />

            <label
              htmlFor="terms"
              className="text-sm leading-5 text-zinc-600"
            >
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="tk-link">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="tk-link">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          {fieldErrors.terms?.[0] && (
            <p id="terms-error" className="tk-field-error">
              {fieldErrors.terms[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tk-btn tk-btn-primary tk-btn-lg w-full"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
