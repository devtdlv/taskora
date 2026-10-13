import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { isEmailVerificationEnforced } from "@/lib/email-verification-policy";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getSafeRedirectPath } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";
import { EMAIL_VERIFICATION_TOKEN_LIFETIME_MS } from "@/lib/token";
import { verifyEmailPath } from "@/lib/verify-email-path";

import { ResendVerification } from "./resend-verification";

export const metadata: Metadata = {
  title: "Verify your email | Taskora",
};

const LIFETIME_HOURS = EMAIL_VERIFICATION_TOKEN_LIFETIME_MS / (60 * 60 * 1000);

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    delivery?: string | string[];
  }>;
}) {
  const { next, delivery } = await searchParams;
  const safePath = getSafeRedirectPath(next);
  // Sending a verified user back here would bounce between the two pages.
  const redirectPath = safePath.startsWith("/verify-email")
    ? "/dashboard"
    : safePath;
  const user = await getCurrentUser();

  if (!user) {
    const loginNext = encodeURIComponent(
      redirectPath === "/dashboard"
        ? "/verify-email"
        : `/verify-email?next=${encodeURIComponent(redirectPath)}`,
    );

    redirect(`/login?next=${loginNext}`);
  }

  if (user.emailVerifiedAt) {
    redirect(redirectPath);
  }

  // Only known values are used, and only to pick a fixed message, so nothing
  // from the URL is ever shown on the page.
  const initialNotice =
    delivery === "sent" ? "sent" : delivery === "failed" ? "failed" : null;

  return (
    <AuthShell
      title="Verify your email"
      description="Confirm your email address so we know it's really you and can reach you about your account."
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <span>Not you?</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="tk-link">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="tk-card p-5">
          <p className="text-sm text-zinc-600">Verification emails go to</p>
          <p className="mt-1 text-base font-medium break-all text-ink">
            {user.email}
          </p>
          <p className="tk-hint">
            The link expires after {LIFETIME_HOURS} hours and can only be used
            once. If you don&apos;t see the email, check your spam folder.
          </p>
        </div>

        <ResendVerification
          email={user.email}
          initialNotice={initialNotice}
          cooldownSeconds={RATE_LIMITS.verificationResendCooldown.windowSeconds}
        />

        {isEmailVerificationEnforced() ? (
          // A full reload re-runs the check above, which moves a verified
          // user on to where they were going.
          <a
            href={verifyEmailPath(redirectPath)}
            className="tk-btn tk-btn-secondary tk-btn-lg w-full"
          >
            I&apos;ve verified my email
          </a>
        ) : (
          <Link
            href={redirectPath}
            className="tk-btn tk-btn-secondary tk-btn-lg w-full"
          >
            Continue to Taskora
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
