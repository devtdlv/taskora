import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaceMembership } from "@/services/workspace.service";

// The layout only decides what the navigation shows. Every page below still
// runs its own membership or project check, because layouts aren't re-rendered
// on client-side navigation.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return (
    <AppShell
      user={user}
      workspace={{
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
      }}
    >
      {children}
    </AppShell>
  );
}
