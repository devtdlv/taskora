import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { toDateOnly } from "@/lib/task";
import { getWorkspaceProject } from "@/services/project.service";
import { getProjectTasks } from "@/services/task.service";

import { KanbanBoard } from "./kanban-board";
import { ProjectHeader } from "./project-header";
import { ProjectTabs } from "./project-tabs";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}`,
  );
  const project = await getWorkspaceProject(user.id, slug, projectSlug);

  if (!project) {
    notFound();
  }

  const { workspace } = project;
  const tasks = await getProjectTasks(project.id);
  const projectHref = `/workspaces/${workspace.slug}/projects/${project.slug}`;
  const isArchived = project.archivedAt !== null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: project.name },
        ]}
      />

      <ProjectHeader
        workspaceSlug={workspace.slug}
        projectSlug={project.slug}
        name={project.name}
        description={project.description}
        archivedAt={project.archivedAt?.toISOString() ?? null}
        showCreateTask={tasks.length > 0}
      />

      <ProjectTabs projectHref={projectHref} current="board" />

      <section aria-labelledby="tasks-heading" className="mt-8">
        <div className="flex items-center gap-2">
          <h2 id="tasks-heading" className="tk-section-title">
            Tasks
          </h2>
          {tasks.length > 0 && <span className="tk-badge">{tasks.length}</span>}
        </div>

        {tasks.length === 0 ? (
          <div className="tk-empty mt-4">
            <h3 className="tk-section-title">No tasks yet</h3>

            {isArchived ? (
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                This project was archived without any tasks. Restore it to
                start adding some.
              </p>
            ) : (
              <>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                  Break this project into tasks so everyone knows what needs
                  to happen next.
                </p>

                <Link
                  href={`${projectHref}/tasks/new`}
                  className="tk-btn tk-btn-primary mt-6"
                >
                  Create task
                </Link>
              </>
            )}
          </div>
        ) : (
          <KanbanBoard
            projectHref={projectHref}
            readOnly={isArchived}
            tasks={tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate ? toDateOnly(task.dueDate) : null,
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
