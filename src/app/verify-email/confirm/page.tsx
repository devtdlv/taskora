import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/session";
import { EMAIL_VERIFICATION_TOKEN_LIFETIME_MS } from "@/lib/token";

import { ConfirmEmail } from "./confirm-email";

export const metadata: Metadata = {
  title: "Confirm your email | Taskora",
};

// The token lives in the URL fragment, which never reaches the server, so this
// page only renders the shell. The browser reads the token and submits it.
export default async function ConfirmEmailPage() {
  const isSignedIn = Boolean(await getCurrentUser());

  return (
    <AuthShell
      title="Confirm your email"
      description="Confirm this email address to finish setting up your Taskora account."
      footer={
        isSignedIn ? (
          <Link href="/dashboard" className="tk-link">
            Back to Taskora
          </Link>
        ) : (
          <>
            Already verified?{" "}
            <Link href="/login" className="tk-link">
              Log in
            </Link>
          </>
        )
      }
    >
      <ConfirmEmail
        isSignedIn={isSignedIn}
        lifetimeHours={EMAIL_VERIFICATION_TOKEN_LIFETIME_MS / (60 * 60 * 1000)}
      />
    </AuthShell>
  );
}
