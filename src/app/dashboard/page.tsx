import type { Metadata } from "next";
import Link from "next/link";

import { requireVerifiedUser } from "@/lib/auth-guard";
import { getInitials } from "@/lib/initials";
import { getOpenTaskCounts } from "@/services/task.service";
import { getUserWorkspaces } from "@/services/workspace.service";

export const metadata: Metadata = {
  title: "Dashboard | Taskora",
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const user = await requireVerifiedUser("/dashboard");

  const [memberships, taskCounts] = await Promise.all([
    getUserWorkspaces(user.id),
    getOpenTaskCounts(user.id),
  ]);

  const projectCount = memberships.reduce(
    (total, { workspace }) => total + workspace._count.projects,
    0,
  );

  const stats = [
    {
      label: "Workspaces",
      value: memberships.length,
      hint: "Owned or joined",
    },
    {
      label: "Projects",
      value: projectCount,
      hint: "Active, across your workspaces",
    },
    {
      label: "Open tasks",
      value: taskCounts.open,
      hint: "To do or in progress",
    },
    {
      label: "Assigned to you",
      value: taskCounts.assignedToUser,
      hint: "Open tasks with your name on them",
    },
  ];

  return (
    <>
      <div className="tk-page-header">
        <div>
          <h1 className="tk-page-title">Welcome, {user.name}</h1>
          <p className="tk-page-description">
            {memberships.length > 0
              ? "Here's where your workspaces and open work stand."
              : "Set up a workspace to start organizing your team's work."}
          </p>
        </div>

        {memberships.length > 0 && (
          <Link
            href="/workspaces/new"
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            Create workspace
          </Link>
        )}
      </div>

      {memberships.length === 0 ? (
        <div className="tk-empty mt-8">
          <span
            aria-hidden="true"
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-50 text-2xl leading-none text-indigo-600"
          >
            +
          </span>

          <h2 className="tk-section-title mt-4">Create your first workspace</h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
            Workspaces keep your team&apos;s projects, tasks, and members
            together. You&apos;ll be the owner and can invite others once
            it&apos;s set up.
          </p>

          <Link href="/workspaces/new" className="tk-btn tk-btn-primary mt-6">
            Create workspace
          </Link>

          <p className="mx-auto mt-6 max-w-md text-xs leading-5 text-zinc-500">
            Joining an existing team? Open the invitation link a workspace
            owner shared with you.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="overview-heading" className="mt-8">
            <h2 id="overview-heading" className="sr-only">
              Overview
            </h2>

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="tk-card p-4 sm:p-5">
                  <dt className="text-sm font-medium text-zinc-600">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                    {stat.value}
                  </dd>
                  <dd className="mt-1 text-xs leading-5 text-zinc-500">
                    {stat.hint}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="workspaces-heading" className="mt-10">
            <h2 id="workspaces-heading" className="tk-section-title">
              Your workspaces
            </h2>

            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {memberships.map(({ role, workspace }) => (
                <li key={workspace.id}>
                  <Link
                    href={`/workspaces/${workspace.slug}`}
                    className="tk-card tk-card-interactive flex h-full flex-col p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="tk-avatar size-10 text-sm">
                        {getInitials(workspace.name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">
                          {workspace.name}
                        </p>
                        <p className="truncate text-sm text-zinc-500">
                          /{workspace.slug}
                        </p>
                      </div>

                      <span
                        className={`tk-badge shrink-0 ${
                          role === "OWNER" ? "tk-badge-accent" : ""
                        }`}
                      >
                        {role === "OWNER" ? "Owner" : "Member"}
                      </span>
                    </div>

                    <p className="mt-5 border-t border-line pt-4 text-sm text-zinc-600">
                      {countLabel(workspace._count.projects, "project", "projects")}
                      <span aria-hidden="true" className="mx-2 text-zinc-300">
                        &middot;
                      </span>
                      <span className="sr-only">, </span>
                      {countLabel(workspace._count.members, "member", "members")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
