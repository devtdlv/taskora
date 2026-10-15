import type { Metadata } from "next";

import { requireVerifiedUser } from "@/lib/auth-guard";

import { EmailStatus } from "./email-status";
import { OtherSessions } from "./other-sessions";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Settings | Taskora",
};

export default async function SettingsPage() {
  const user = await requireVerifiedUser("/settings");

  return (
    <>
      <div className="tk-page-header">
        <div>
          <h1 className="tk-page-title">Settings</h1>
          <p className="tk-page-description">
            Manage your profile, password, and signed-in devices.
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl space-y-6">
        <section aria-labelledby="profile-heading" className="tk-card p-5 sm:p-6">
          <h2 id="profile-heading" className="tk-section-title">
            Profile
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Your name is shown to people in your workspaces.
          </p>
          <ProfileForm name={user.name} />
        </section>

        <section aria-labelledby="email-heading" className="tk-card p-5 sm:p-6">
          <h2 id="email-heading" className="tk-section-title">
            Email
          </h2>
          <EmailStatus email={user.email} verified={Boolean(user.emailVerifiedAt)} />
        </section>

        <section aria-labelledby="password-heading" className="tk-card p-5 sm:p-6">
          <h2 id="password-heading" className="tk-section-title">
            Password
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Changing your password signs you out on every other device.
          </p>
          <PasswordForm />
        </section>

        <OtherSessions />
      </div>
    </>
  );
}
