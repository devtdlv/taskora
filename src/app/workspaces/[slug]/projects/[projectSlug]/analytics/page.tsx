import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { PriorityBadge } from "@/components/priority-badge";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { TASK_PRIORITIES, TASK_STATUS_LABELS } from "@/lib/task";
import { getProjectAnalytics } from "@/services/analytics.service";

import { ProjectTabs } from "../project-tabs";

export const metadata: Metadata = {
  title: "Analytics",
};

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

function taskCount(count: number) {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}/analytics`,
  );
  const result = await getProjectAnalytics(user.id, slug, projectSlug);

  if (!result) {
    notFound();
  }

  const { project, analytics } = result;
  const { workspace } = project;
  const projectHref = `/workspaces/${workspace.slug}/projects/${project.slug}`;
  const isArchived = project.archivedAt !== null;
  const isEmpty = analytics.total === 0;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: project.name, href: projectHref },
          { label: "Analytics" },
        ]}
      />

      <div className="tk-page-header mt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="tk-page-title break-words">{project.name}</h1>
            {isArchived && <span className="tk-badge">Archived</span>}
          </div>
          <p className="tk-page-description">
            A snapshot of this project&apos;s tasks right now.
          </p>
        </div>
      </div>

      <ProjectTabs projectHref={projectHref} current="analytics" />

      <section aria-labelledby="overview-heading" className="mt-8">
        <h2 id="overview-heading" className="sr-only">
          Task overview
        </h2>

        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="tk-card p-4 sm:p-5">
            <dt className="text-sm text-zinc-600">Total tasks</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink tabular-nums">
              {analytics.total}
            </dd>
          </div>

          {STATUSES.map((status) => (
            <div key={status} className="tk-card p-4 sm:p-5">
              <dt className="text-sm text-zinc-600">
                {TASK_STATUS_LABELS[status]}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-ink tabular-nums">
                {analytics.byStatus[status]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="completion-heading"
        className="tk-card mt-4 p-5 sm:p-6"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="completion-heading" className="tk-section-title">
            Completion
          </h2>
          <p className="text-2xl font-semibold text-ink tabular-nums">
            {analytics.completionPercent}%
          </p>
        </div>

        <div
          role="progressbar"
          aria-labelledby="completion-heading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={analytics.completionPercent}
          aria-valuetext={`${analytics.completionPercent}% complete`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${analytics.completionPercent}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          {isEmpty
            ? "No tasks yet."
            : `${analytics.byStatus.DONE} of ${taskCount(analytics.total)} done.`}
        </p>
      </section>

      {isEmpty ? (
        <div className="tk-empty mt-4">
          <h2 className="tk-section-title">No tasks to analyze</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
            {isArchived
              ? "This project was archived without any tasks."
              : "Status and priority breakdowns appear here once the project has tasks."}
          </p>

          {!isArchived && (
            <Link
              href={`${projectHref}/tasks/new`}
              className="tk-btn tk-btn-primary mt-6"
            >
              Create task
            </Link>
          )}
        </div>
      ) : (
        <section
          aria-labelledby="priority-heading"
          className="tk-card mt-4 p-5 sm:p-6"
        >
          <h2 id="priority-heading" className="tk-section-title">
            Priority
          </h2>

          <ul className="mt-4 space-y-3">
            {TASK_PRIORITIES.map((priority) => {
              const count = analytics.byPriority[priority];

              return (
                <li
                  key={priority}
                  className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3"
                >
                  <span>
                    <PriorityBadge priority={priority} />
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-2 overflow-hidden rounded-full bg-zinc-100"
                  >
                    <span
                      className="block h-full rounded-full bg-zinc-400"
                      style={{ width: `${(count / analytics.total) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-sm text-zinc-700 tabular-nums">
                    {taskCount(count)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
