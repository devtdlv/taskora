import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { getInitials } from "@/lib/initials";
import {
  getArchivedWorkspaceProjects,
  getWorkspaceProjects,
} from "@/services/project.service";
import { getWorkspaceMembership } from "@/services/workspace.service";

import { WorkspaceName } from "./workspace-name";

type ProjectCardProps = {
  href: string;
  project: {
    name: string;
    description: string | null;
    archivedAt: Date | null;
    _count: { tasks: number };
  };
};

function ProjectCard({ href, project }: ProjectCardProps) {
  return (
    <Link
      href={href}
      className="tk-card tk-card-interactive flex h-full flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-semibold text-ink">{project.name}</p>
        {project.archivedAt && (
          <span className="tk-badge shrink-0">Archived</span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-zinc-600">
        {project.description || "No description."}
      </p>

      <p className="mt-4 border-t border-line pt-4 text-sm text-zinc-600">
        {project._count.tasks === 1 ? "1 task" : `${project._count.tasks} tasks`}
      </p>
    </Link>
  );
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireVerifiedUser(`/workspaces/${slug}`);
  const membership = await getWorkspaceMembership(user.id, slug);

  if (!membership) {
    notFound();
  }

  const { workspace, role } = membership;
  const [projects, archivedProjects] = await Promise.all([
    getWorkspaceProjects(workspace.id),
    getArchivedWorkspaceProjects(workspace.id),
  ]);
  const newProjectHref = `/workspaces/${workspace.slug}/projects/new`;
  const projectHref = (projectSlug: string) =>
    `/workspaces/${workspace.slug}/projects/${projectSlug}`;

  return (
    <>
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: workspace.name }]}
      />

      <div className="tk-page-header mt-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span aria-hidden="true" className="tk-avatar size-12 shrink-0 text-base">
            {getInitials(workspace.name)}
          </span>

          <WorkspaceName
            workspaceSlug={workspace.slug}
            name={workspace.name}
            isOwner={role === "OWNER"}
          />
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
            <h3 className="tk-section-title">
              {archivedProjects.length > 0
                ? "No active projects"
                : "No projects yet"}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
              {archivedProjects.length > 0
                ? "Every project in this workspace is archived. Create a new one, or restore an archived project below."
                : "Projects group related work in this workspace. Create the first one to start adding tasks."}
            </p>

            <Link href={newProjectHref} className="tk-btn tk-btn-primary mt-6">
              Create project
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard href={projectHref(project.slug)} project={project} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archivedProjects.length > 0 && (
        <section aria-labelledby="archived-heading" className="mt-10">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/30 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="text-zinc-500 transition-transform group-open:rotate-90"
              >
                &#9656;
              </span>
              <h2 id="archived-heading" className="tk-section-title">
                Archived projects
              </h2>
              <span className="tk-badge">{archivedProjects.length}</span>
            </summary>

            <p className="mt-2 text-sm text-zinc-600">
              Archived projects are read-only. Open one to view its tasks or
              restore it.
            </p>

            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {archivedProjects.map((project) => (
                <li key={project.id}>
                  <ProjectCard
                    href={projectHref(project.slug)}
                    project={project}
                  />
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}
