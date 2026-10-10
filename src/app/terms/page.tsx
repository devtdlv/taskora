import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Terms of Service | Taskora",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="tk-page-title">
          Terms of Service
        </h1>

        <p className="mt-3 text-sm text-zinc-500">
          Last updated: [Owner to complete before launch]
        </p>

        <div
          role="note"
          className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          Draft for owner review. These terms describe how Taskora currently
          works but have not been reviewed by a legal professional. Items
          marked &quot;Owner to complete&quot; must be filled in before public
          launch.
        </div>

        <div className="mt-10 space-y-10 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              About Taskora
            </h2>
            <p className="mt-3">
              Taskora is a project management application for organizing
              workspaces, projects, and tasks. It is operated as a portfolio
              project. Features may change, and the service may be paused or
              discontinued.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Your account
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide an accurate name and an email address you control.</li>
              <li>Keep your password private. You are responsible for activity on your account.</li>
              <li>Log out on shared devices.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Workspaces and your content
            </h2>
            <p className="mt-3">
              You keep ownership of the workspaces, projects, tasks, and
              comments you create. Everything in a workspace is visible to all
              of its members, including names and email addresses. Workspace
              owners decide who to invite, and invited members can see every
              project in that workspace.
            </p>
            <p className="mt-3">
              By adding content, you allow Taskora to store it and show it to
              the members of the workspace it belongs to, which is necessary to
              run the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Acceptable use
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Don&apos;t upload unlawful, harmful, or infringing content.</li>
              <li>Don&apos;t try to access workspaces or accounts you haven&apos;t been given access to.</li>
              <li>Don&apos;t disrupt the service, for example with automated or excessive requests.</li>
            </ul>
            <p className="mt-3">
              Accounts that break these rules may be suspended or removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Availability
            </h2>
            <p className="mt-3">
              [Owner to complete: describe availability, liability, and any
              disclaimers that apply to this service.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Changes to these terms
            </h2>
            <p className="mt-3">
              These terms may be updated as Taskora changes. The date at the top
              of this page shows when they were last updated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Contact</h2>
            <p className="mt-3">
              [Owner to complete: contact email for questions about these
              terms.]
            </p>
          </section>

          <p>
            See also the{" "}
            <Link
              href="/privacy"
              className="font-medium text-zinc-950 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
