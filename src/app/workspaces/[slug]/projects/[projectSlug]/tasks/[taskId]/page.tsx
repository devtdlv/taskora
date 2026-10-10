import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { formatDueDate } from "@/lib/task";
import { getTaskComments } from "@/services/comment.service";
import { getProjectTask } from "@/services/task.service";
import { getWorkspaceMembers } from "@/services/workspace.service";

import { TaskAssigneeSelect } from "./task-assignee-select";
import { TaskComments } from "./task-comments";
import { TaskDetails } from "./task-details";
import { TaskStatusSelect } from "./task-status-select";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string; taskId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug, projectSlug, taskId } = await params;
  const task = await getProjectTask(user.id, slug, projectSlug, taskId);

  if (!task) {
    notFound();
  }

  const { project } = task;
  const { workspace } = project;
  const projectHref = `/workspaces/${workspace.slug}/projects/${project.slug}`;
  const taskUrl = `${projectHref}/tasks/${task.id}`;
  const [members, comments] = await Promise.all([
    getWorkspaceMembers(workspace.id),
    getTaskComments(task.id),
  ]);

  // Due dates are stored at midnight UTC, so the UTC date part is the saved
  // calendar date in the YYYY-MM-DD form a date input expects.
  const dueDateValue = task.dueDate
    ? task.dueDate.toISOString().slice(0, 10)
    : null;

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
          <Link href={projectHref} className="hover:text-zinc-950">
            {project.name}
          </Link>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_240px]">
          <div>
            <TaskDetails
              taskUrl={taskUrl}
              projectHref={projectHref}
              title={task.title}
              description={task.description}
              dueDate={dueDateValue}
            />

            <TaskComments
              taskUrl={taskUrl}
              comments={comments.map((comment) => ({
                id: comment.id,
                body: comment.body,
                authorName: comment.author.name || comment.author.email,
                createdAt: comment.createdAt.toISOString(),
                isOwn: comment.authorId === user.id,
              }))}
            />
          </div>

          <aside className="tk-card space-y-6 p-5">
            <TaskStatusSelect taskUrl={taskUrl} initialStatus={task.status} />

            <TaskAssigneeSelect
              taskUrl={taskUrl}
              assigneeId={task.assigneeId}
              members={members.map((member) => ({
                id: member.id,
                label: member.user.name || member.user.email,
              }))}
            />

            <div>
              <p className="tk-label">Due date</p>
              <p className="mt-2 text-sm text-zinc-600">
                {task.dueDate ? formatDueDate(task.dueDate) : "No due date"}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
