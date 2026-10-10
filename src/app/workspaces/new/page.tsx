import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";

import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function NewWorkspacePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-lg px-6 py-16">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:text-zinc-950"
        >
          &larr; Back to dashboard
        </Link>

        <h1 className="tk-page-title mt-6">
          Create a workspace
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">
          A workspace is where your team&apos;s projects and tasks live.
          You&apos;ll be its owner.
        </p>

        <div className="mt-9">
          <CreateWorkspaceForm />
        </div>
      </main>
    </div>
  );
}
