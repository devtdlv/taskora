import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaceProject } from "@/services/project.service";

import { CreateTaskForm } from "./create-task-form";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug, projectSlug } = await params;
  const project = await getWorkspaceProject(user.id, slug, projectSlug);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-lg px-6 py-16">
        <Link
          href={`/workspaces/${project.workspace.slug}/projects/${project.slug}`}
          className="text-sm text-zinc-600 hover:text-zinc-950"
        >
          &larr; Back to {project.name}
        </Link>

        <h1 className="tk-page-title mt-6">
          Create a task
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">
          New tasks start in To do. You can change the status from the task
          page.
        </p>

        <div className="mt-9">
          <CreateTaskForm
            workspaceSlug={project.workspace.slug}
            projectSlug={project.slug}
          />
        </div>
      </main>
    </div>
  );
}
