import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy | Taskora",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="tk-page-title">
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm text-zinc-500">
          Last updated: [Owner to complete before launch]
        </p>

        <div
          role="note"
          className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          Draft for owner review. This policy describes the data Taskora
          currently stores but has not been reviewed by a legal professional.
          Items marked &quot;Owner to complete&quot; must be filled in before
          public launch.
        </div>

        <div className="mt-10 space-y-10 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Information Taskora stores
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Your name and email address.</li>
              <li>
                Your password, stored only as a one-way hash. The password
                itself is never stored.
              </li>
              <li>
                Content you create: workspaces, projects, tasks, due dates,
                assignments, and comments.
              </li>
              <li>
                Email addresses that workspace owners enter when creating
                invitations.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              How it is used
            </h2>
            <p className="mt-3">
              This information is used only to run Taskora: signing you in,
              showing your workspaces, and letting members work together. Your
              name and email address are visible to other members of the
              workspaces you belong to.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Cookies</h2>
            <p className="mt-3">
              Taskora uses a single essential cookie to keep you signed in. It
              does not use advertising or analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Service providers
            </h2>
            <p className="mt-3">
              Your data is not sold. It is stored and processed by the hosting
              and database providers that run Taskora, which may also process
              IP addresses for security and abuse prevention.
            </p>
            <p className="mt-3">
              [Owner to complete: list the hosting and database providers and
              the regions where data is stored.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Retention and deletion
            </h2>
            <p className="mt-3">
              Your data is kept while your account exists. Taskora does not yet
              offer self-service account deletion.
            </p>
            <p className="mt-3">
              [Owner to complete: how to request access to or deletion of your
              data, and how long backups are kept.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Security</h2>
            <p className="mt-3">
              Passwords and session tokens are stored as hashes, and access to
              workspace data is checked on the server for every request. No
              system is completely secure, so use a password you don&apos;t use
              anywhere else.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Contact</h2>
            <p className="mt-3">
              [Owner to complete: contact email for privacy questions.]
            </p>
          </section>

          <p>
            See also the{" "}
            <Link
              href="/terms"
              className="font-medium text-zinc-950 hover:underline"
            >
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
