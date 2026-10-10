import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { formatDueDate } from "@/lib/task";
import { getWorkspaceProject } from "@/services/project.service";
import { getProjectTasks } from "@/services/task.service";

import { KanbanBoard } from "./kanban-board";

export default async function ProjectPage({
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

  const { workspace } = project;
  const tasks = await getProjectTasks(project.id);
  const projectHref = `/workspaces/${workspace.slug}/projects/${project.slug}`;

  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-zinc-600"
        >
          <Link href="/dashboard" className="hover:text-zinc-950">
            Workspaces
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/workspaces/${workspace.slug}`}
            className="hover:text-zinc-950"
          >
            {workspace.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-zinc-950">
            {project.name}
          </span>
        </nav>

        <h1 className="tk-page-title mt-6">{project.name}</h1>

        {project.description && (
          <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-zinc-600">
            {project.description}
          </p>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="tk-section-title">Tasks</h2>

            {tasks.length > 0 && (
              <Link
                href={`${projectHref}/tasks/new`}
                className="tk-btn tk-btn-primary"
              >
                Create task
              </Link>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center">
              <h3 className="font-semibold">No tasks yet</h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                Break this project into tasks so everyone knows what needs to
                happen next.
              </p>

              <Link
                href={`${projectHref}/tasks/new`}
                className="tk-btn tk-btn-primary mt-6"
              >
                Create task
              </Link>
            </div>
          ) : (
            <KanbanBoard
              projectHref={projectHref}
              tasks={tasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                dueDate: task.dueDate ? formatDueDate(task.dueDate) : null,
                assigneeName: task.assignee
                  ? task.assignee.user.name || task.assignee.user.email
                  : null,
              }))}
            />
          )}
        </section>
      </main>
    </div>
  );
}
