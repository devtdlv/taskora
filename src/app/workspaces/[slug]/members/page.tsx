import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { getInitials } from "@/lib/initials";
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
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: workspace.name, href: `/workspaces/${workspace.slug}` },
          { label: "Members" },
        ]}
      />

      <div className="mt-4">
        <h1 className="tk-page-title">Members</h1>
        <p className="tk-page-description">
          People who have access to {workspace.name}.
        </p>
      </div>

      {role === "OWNER" && (
        <section aria-labelledby="invite-heading" className="tk-card mt-8 p-5 sm:p-6">
          <h2 id="invite-heading" className="tk-section-title">
            Invite member
          </h2>

          <p className="mt-1 text-sm text-zinc-600">
            Create an invitation link for someone to join as a member.
          </p>

          <div className="mt-5">
            <InviteMemberForm workspaceSlug={workspace.slug} />
          </div>
        </section>
      )}

      <section aria-labelledby="members-heading" className="mt-10">
        <div className="flex items-center gap-2">
          <h2 id="members-heading" className="tk-section-title">
            People
          </h2>
          <span className="tk-badge">{members.length}</span>
        </div>

        <ul className="tk-card mt-4 divide-y divide-zinc-200 overflow-hidden">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700"
                >
                  {getInitials(member.user.name)}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {member.user.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {member.user.email}
                  </p>
                </div>
              </div>

              <span
                className={`tk-badge shrink-0 ${
                  member.role === "OWNER" ? "tk-badge-accent" : ""
                }`}
              >
                {member.role === "OWNER" ? "Owner" : "Member"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
