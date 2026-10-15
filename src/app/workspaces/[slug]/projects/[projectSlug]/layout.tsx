import { notFound } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth-guard";
import { getWorkspaceProject } from "@/services/project.service";

// Runs outside this segment's loading.tsx, so a missing or inaccessible
// project gets a real 404 status before streaming starts. Keep every Suspense
// boundary between here and the workspace layout out of this path. Pages below
// still check the project themselves on client-side navigation.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return children;
}
