import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth-guard";
import { getWorkspaceProject } from "@/services/project.service";

type ProjectLayoutProps = {
  params: Promise<{ slug: string; projectSlug: string }>;
};

async function loadProject(params: ProjectLayoutProps["params"]) {
  const { slug, projectSlug } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}`,
  );

  return getWorkspaceProject(user.id, slug, projectSlug);
}

export async function generateMetadata({
  params,
}: ProjectLayoutProps): Promise<Metadata> {
  const project = await loadProject(params);

  if (!project) {
    return {};
  }

  return {
    title: {
      absolute: `${project.name} - ${project.workspace.name} | Taskora`,
      template: `%s - ${project.name} | Taskora`,
    },
  };
}

// Runs outside this segment's loading.tsx, so a missing or inaccessible
// project gets a real 404 status before streaming starts. Keep every Suspense
// boundary between here and the workspace layout out of this path. Pages below
// still check the project themselves on client-side navigation.
export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps & { children: React.ReactNode }) {
  if (!(await loadProject(params))) {
    notFound();
  }

  return children;
}
