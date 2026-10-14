import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { getWorkspaceProject } from "@/services/project.service";

import { CreateTaskForm } from "./create-task-form";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}/tasks/new`,
  );
  const project = await getWorkspaceProject(user.id, slug, projectSlug);

  if (!project) {
    notFound();
  }

  const workspaceHref = `/workspaces/${project.workspace.slug}`;
  const projectHref = `${workspaceHref}/projects/${project.slug}`;

  return (
    <div className="max-w-2xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.workspace.name, href: workspaceHref },
          {
            label: project.name,
            href: projectHref,
          },
          { label: "New task" },
        ]}
      />

      {project.archivedAt ? (
        <div className="tk-empty mt-4">
          <h1 className="tk-section-title">This project is archived</h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
            Archived projects are read-only, so new tasks can&apos;t be added.
            Restore the project from its page to make changes again.
          </p>

          <Link href={projectHref} className="tk-btn tk-btn-secondary mt-6">
            Back to project
          </Link>
        </div>
      ) : (
        <div className="tk-card mt-4 p-5 sm:p-8">
          <h1 className="tk-page-title">Create a task</h1>

          <p className="tk-page-description">
            New tasks start in To do. You can change the status from the task
            page.
          </p>

          <div className="mt-8">
            <CreateTaskForm
              workspaceSlug={project.workspace.slug}
              projectSlug={project.slug}
            />
          </div>
        </div>
      )}
    </div>
  );
}
