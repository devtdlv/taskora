import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { getWorkspaceMembership } from "@/services/workspace.service";

import { CreateProjectForm } from "./create-project-form";

export const metadata: Metadata = {
  title: "New project",
};

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireVerifiedUser(`/workspaces/${slug}/projects/new`);
  const membership = await getWorkspaceMembership(user.id, slug);

  if (!membership) {
    notFound();
  }

  const { workspace } = membership;

  return (
    <div className="max-w-2xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: "New project" },
        ]}
      />

      <div className="tk-card mt-4 p-5 sm:p-8">
        <h1 className="tk-page-title">Create a project</h1>

        <p className="tk-page-description">
          Projects group related work in {workspace.name}. Everyone in the
          workspace will be able to see it.
        </p>

        <div className="mt-8">
          <CreateProjectForm workspaceSlug={workspace.slug} />
        </div>
      </div>
    </div>
  );
}
