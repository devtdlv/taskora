import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaceMembership } from "@/services/workspace.service";

import { CreateProjectForm } from "./create-project-form";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;
  const membership = await getWorkspaceMembership(user.id, slug);

  if (!membership) {
    notFound();
  }

  const { workspace } = membership;

  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-lg px-6 py-16">
        <Link
          href={`/workspaces/${workspace.slug}`}
          className="text-sm text-zinc-600 hover:text-zinc-950"
        >
          &larr; Back to {workspace.name}
        </Link>

        <h1 className="tk-page-title mt-6">
          Create a project
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Projects group related work in {workspace.name}. Everyone in the
          workspace will be able to see it.
        </p>

        <div className="mt-9">
          <CreateProjectForm workspaceSlug={workspace.slug} />
        </div>
      </main>
    </div>
  );
}
