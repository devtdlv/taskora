import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
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
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[200px_1fr]">
        <aside>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:text-zinc-950"
          >
            &larr; All workspaces
          </Link>

          <nav aria-label="Workspace" className="mt-8 space-y-1 text-sm">
            <span
              aria-current="page"
              className="block rounded-md bg-zinc-100 px-3 py-2 font-medium"
            >
              Projects
            </span>

            <Link
              href={`/workspaces/${workspace.slug}/members`}
              className="block rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
            >
              Members
            </Link>
          </nav>
        </aside>

        <main>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="tk-page-title">{workspace.name}</h1>

              <p className="mt-2 text-sm text-zinc-500">/{workspace.slug}</p>
            </div>

            <span className="tk-badge shrink-0">
              {role === "OWNER" ? "Owner" : "Member"}
            </span>
          </div>

          <section className="mt-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="tk-section-title">Projects</h2>

              {projects.length > 0 && (
                <Link href={newProjectHref} className="tk-btn tk-btn-primary">
                  Create project
                </Link>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center">
                <h3 className="font-semibold">No projects yet</h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                  Projects group related work in this workspace. Create the
                  first one to get started.
                </p>

                <Link href={newProjectHref} className="tk-btn tk-btn-primary mt-6">
                  Create project
                </Link>
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/workspaces/${workspace.slug}/projects/${project.slug}`}
                      className="tk-card tk-card-interactive block h-full p-5"
                    >
                      <p className="font-semibold">{project.name}</p>

                      {project.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                          {project.description}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
