import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
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
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: project.name },
        ]}
      />

      <div className="tk-page-header mt-4">
        <div className="min-w-0">
          <h1 className="tk-page-title break-words">{project.name}</h1>

          {project.description && (
            <p className="tk-page-description whitespace-pre-line">
              {project.description}
            </p>
          )}
        </div>

        {tasks.length > 0 && (
          <Link
            href={`${projectHref}/tasks/new`}
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            Create task
          </Link>
        )}
      </div>

      <section aria-labelledby="tasks-heading" className="mt-10">
        <div className="flex items-center gap-2">
          <h2 id="tasks-heading" className="tk-section-title">
            Tasks
          </h2>
          {tasks.length > 0 && <span className="tk-badge">{tasks.length}</span>}
        </div>

        {tasks.length === 0 ? (
          <div className="tk-empty mt-4">
            <h3 className="tk-section-title">No tasks yet</h3>

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
    </>
  );
}
