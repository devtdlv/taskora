import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { DueDateBadge } from "@/components/due-date-badge";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { toDateOnly } from "@/lib/task";
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
  const { slug, projectSlug, taskId } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}/tasks/${taskId}`,
  );
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

  // YYYY-MM-DD, the form both the date input and the due-date badge expect.
  const dueDateValue = task.dueDate ? toDateOnly(task.dueDate) : null;
  const readOnly = project.archivedAt !== null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: project.name, href: projectHref },
          { label: task.title },
        ]}
      />

      {readOnly && (
        <div role="status" className="tk-alert-warning mt-4">
          <span className="font-semibold">Archived project.</span> This task
          is read-only until the project is restored.
        </div>
      )}

      {/* On small screens the properties panel sits between the task and its
          comments. From md up it moves to a sticky right column that spans
          both, and the 1fr second row absorbs its extra height. */}
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-8">
        <div className="tk-card min-w-0 p-5 sm:p-8 md:col-start-1">
          <TaskDetails
            taskUrl={taskUrl}
            projectHref={projectHref}
            title={task.title}
            description={task.description}
            dueDate={dueDateValue}
            readOnly={readOnly}
          />
        </div>

        <aside
          aria-labelledby="properties-heading"
          className="tk-card md:sticky md:top-20 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start lg:top-10"
        >
          <h2
            id="properties-heading"
            className="border-b border-line px-5 py-4 text-sm font-semibold text-ink"
          >
            Properties
          </h2>

          <div className="space-y-5 p-5">
            <TaskStatusSelect
              taskUrl={taskUrl}
              initialStatus={task.status}
              readOnly={readOnly}
            />

            <TaskAssigneeSelect
              taskUrl={taskUrl}
              assigneeId={task.assigneeId}
              readOnly={readOnly}
              members={members.map((member) => ({
                id: member.id,
                label: member.user.name || member.user.email,
              }))}
            />

            <div>
              <p className="tk-label">Due date</p>
              <div className="mt-2 text-sm text-zinc-600">
                {dueDateValue ? (
                  <DueDateBadge
                    dueDate={dueDateValue}
                    isDone={task.status === "DONE"}
                  />
                ) : (
                  "No due date"
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 md:col-start-1">
          <TaskComments
            taskUrl={taskUrl}
            readOnly={readOnly}
            comments={comments.map((comment) => ({
              id: comment.id,
              body: comment.body,
              authorName: comment.author.name || comment.author.email,
              createdAt: comment.createdAt.toISOString(),
              isOwn: comment.authorId === user.id,
            }))}
          />
        </div>
      </div>
    </>
  );
}
