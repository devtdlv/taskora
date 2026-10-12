import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { PASSWORD_RESET_TOKEN_LIFETIME_MS } from "@/lib/token";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot your password | Taskora",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email address you use for Taskora and we'll send you a link to reset your password."
      footer={
        <>
          Remembered your password?{" "}
          <Link href="/login" className="tk-link">
            Log in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm
        lifetimeMinutes={PASSWORD_RESET_TOKEN_LIFETIME_MS / (60 * 1000)}
      />
    </AuthShell>
  );
}
