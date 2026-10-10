import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { getInitials } from "@/lib/initials";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaceProjects } from "@/services/project.service";
import { getWorkspaceMembership } from "@/services/workspace.service";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;
  const membership = await getWorkspaceMembership(user.id, slug);

  if (!membership) {
    notFound();
  }

  const { workspace, role } = membership;
  const projects = await getWorkspaceProjects(workspace.id);
  const newProjectHref = `/workspaces/${workspace.slug}/projects/new`;

  return (
    <>
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: workspace.name }]}
      />

      <div className="tk-page-header mt-4">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="tk-avatar size-12 text-base">
            {getInitials(workspace.name)}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="tk-page-title truncate">{workspace.name}</h1>
              <span
                className={`tk-badge ${role === "OWNER" ? "tk-badge-accent" : ""}`}
              >
                {role === "OWNER" ? "Owner" : "Member"}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-zinc-500">/{workspace.slug}</p>
          </div>
        </div>

        {projects.length > 0 && (
          <Link
            href={newProjectHref}
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            Create project
          </Link>
        )}
      </div>

      <section aria-labelledby="projects-heading" className="mt-10">
        <div className="flex items-center gap-2">
          <h2 id="projects-heading" className="tk-section-title">
            Projects
          </h2>
          {projects.length > 0 && (
            <span className="tk-badge">{projects.length}</span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="tk-empty mt-4">
            <h3 className="tk-section-title">No projects yet</h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
              Projects group related work in this workspace. Create the first
              one to start adding tasks.
            </p>

            <Link href={newProjectHref} className="tk-btn tk-btn-primary mt-6">
              Create project
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/workspaces/${workspace.slug}/projects/${project.slug}`}
                  className="tk-card tk-card-interactive flex h-full flex-col p-5"
                >
                  <p className="truncate font-semibold text-ink">{project.name}</p>

                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-zinc-600">
                    {project.description || "No description."}
                  </p>

                  <p className="mt-4 border-t border-line pt-4 text-sm text-zinc-600">
                    {project._count.tasks === 1
                      ? "1 task"
                      : `${project._count.tasks} tasks`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
