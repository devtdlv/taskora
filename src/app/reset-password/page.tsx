import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";
import { PASSWORD_RESET_TOKEN_LIFETIME_MS } from "@/lib/token";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset your password | Taskora",
};

// The token lives in the URL fragment, which never reaches the server, so this
// page only renders the shell. The browser reads the token and submits it.
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Choose a new password for your Taskora account."
    >
      <ResetPasswordForm
        lifetimeMinutes={PASSWORD_RESET_TOKEN_LIFETIME_MS / (60 * 1000)}
      />
    </AuthShell>
  );
}
