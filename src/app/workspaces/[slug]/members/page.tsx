import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import {
  getWorkspaceMembers,
  getWorkspaceMembership,
} from "@/services/workspace.service";

import { InviteMemberForm } from "./invite-member-form";

export default async function WorkspaceMembersPage({
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
  const members = await getWorkspaceMembers(workspace.id);

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
            <Link
              href={`/workspaces/${workspace.slug}`}
              className="block rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
            >
              Projects
            </Link>

            <span
              aria-current="page"
              className="block rounded-md bg-zinc-100 px-3 py-2 font-medium"
            >
              Members
            </span>
          </nav>
        </aside>

        <main>
          <h1 className="tk-page-title">Members</h1>

          <p className="mt-2 text-sm text-zinc-500">
            People who have access to {workspace.name}.
          </p>

          {role === "OWNER" && (
            <section className="tk-card mt-10 p-5">
              <h2 className="tk-section-title">Invite member</h2>

              <p className="mt-1 text-sm text-zinc-600">
                Create an invitation link for someone to join as a member.
              </p>

              <div className="mt-5">
                <InviteMemberForm workspaceSlug={workspace.slug} />
              </div>
            </section>
          )}

          <ul className="tk-card mt-10 divide-y divide-zinc-200 overflow-hidden">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.user.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {member.user.email}
                  </p>
                </div>

                <span className="tk-badge shrink-0">
                  {member.role === "OWNER" ? "Owner" : "Member"}
                </span>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
