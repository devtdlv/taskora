import Link from "next/link";

import { ResendVerification } from "@/app/verify-email/resend-verification";
import { AuthShell } from "@/components/auth-shell";
import { needsEmailVerification } from "@/lib/email-verification-policy";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { getInvitationByToken } from "@/services/invitation.service";
import { getWorkspaceMembership } from "@/services/workspace.service";

import { AcceptInvitationButton } from "./accept-invitation-button";

const linkButtonClass = "tk-btn tk-btn-primary tk-btn-lg w-full";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  // Signed-out visitors get no details about the invitation. Only a signed-in
  // account with the invited email should learn which workspace it's for.
  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`);

    return (
      <AuthShell
        title="You've been invited"
        description="Log in or create an account using the email address this invitation was sent to."
        footer="You'll come back to this invitation afterwards."
      >
        <div className="space-y-3">
          <Link href={`/login?next=${next}`} className={linkButtonClass}>
            Log in
          </Link>

          <Link
            href={`/signup?next=${next}`}
            className="tk-btn tk-btn-secondary tk-btn-lg w-full"
          >
            Create an account
          </Link>
        </div>
      </AuthShell>
    );
  }

  const invitation = await getInvitationByToken(token);
  const footer = `Signed in as ${user.email}`;

  if (!invitation) {
    return (
      <AuthShell
        title="Invitation not found"
        description="This invitation link is invalid. Ask the workspace owner for a new one."
        footer={footer}
      >
        <Link href="/dashboard" className={linkButtonClass}>
          Go to dashboard
        </Link>
      </AuthShell>
    );
  }

  if (invitation.email !== user.email) {
    return (
      <AuthShell
        title="Wrong account"
        description="This invitation was sent to a different email address. Log in with that account to accept it."
        footer={footer}
      >
        <Link href="/dashboard" className={linkButtonClass}>
          Go to dashboard
        </Link>
      </AuthShell>
    );
  }

  // The address isn't proven yet, so the workspace and the invitation's state
  // stay hidden until it is. Verification happens here rather than on
  // /verify-email so the token never has to travel in a query string.
  if (needsEmailVerification(user)) {
    return (
      <AuthShell
        title="Verify your email to join"
        description="Open the verification link we sent you, then come back to this page to see the invitation."
        footer={footer}
      >
        <div className="space-y-4">
          <ResendVerification
            email={user.email}
            initialNotice={null}
            cooldownSeconds={RATE_LIMITS.verificationResendCooldown.windowSeconds}
          />

          {/* A full reload re-runs the check above. */}
          <a
            href={`/invite/${token}`}
            className="tk-btn tk-btn-secondary tk-btn-lg w-full"
          >
            I&apos;ve verified my email
          </a>
        </div>
      </AuthShell>
    );
  }

  const { workspace } = invitation;

  if (invitation.acceptedAt) {
    const membership = await getWorkspaceMembership(user.id, workspace.slug);

    return (
      <AuthShell
        title={membership ? "You're already a member" : "Invitation already used"}
        description={
          membership
            ? `You already have access to ${workspace.name}.`
            : "This invitation has already been used. Ask the workspace owner for a new one."
        }
        footer={footer}
      >
        <Link
          href={membership ? `/workspaces/${workspace.slug}` : "/dashboard"}
          className={linkButtonClass}
        >
          {membership ? `Go to ${workspace.name}` : "Go to dashboard"}
        </Link>
      </AuthShell>
    );
  }

  if (invitation.expiresAt <= new Date()) {
    return (
      <AuthShell
        title="Invitation expired"
        description="This invitation has expired. Ask the workspace owner for a new one."
        footer={footer}
      >
        <Link href="/dashboard" className={linkButtonClass}>
          Go to dashboard
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${workspace.name}`}
      description="You've been invited to join this workspace as a member."
      footer={footer}
    >
      <AcceptInvitationButton token={token} />
    </AuthShell>
  );
}
