import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";
import { getPendingWorkspaceInvitations } from "@/services/invitation.service";
import {
  getWorkspaceMembers,
  getWorkspaceMembership,
} from "@/services/workspace.service";

import { InviteMemberForm } from "./invite-member-form";
import { LeaveWorkspace } from "./leave-workspace";
import { MembersList } from "./members-list";
import { PendingInvitations } from "./pending-invitations";

export default async function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireVerifiedUser(`/workspaces/${slug}/members`);
  const membership = await getWorkspaceMembership(user.id, slug);

  if (!membership) {
    notFound();
  }

  const { workspace, role } = membership;
  const isOwner = role === "OWNER";
  const [members, invitations] = await Promise.all([
    getWorkspaceMembers(workspace.id),
    isOwner ? getPendingWorkspaceInvitations(workspace.id) : null,
  ]);
  const ownerCount = members.filter((member) => member.role === "OWNER").length;

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

      {isOwner && (
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

        <MembersList
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          canRemove={isOwner}
          members={members.map((member) => ({
            id: member.id,
            name: member.user.name || member.user.email,
            email: member.user.email,
            role: member.role,
            isCurrentUser: member.userId === user.id,
          }))}
        />
      </section>

      {invitations && (
        <section aria-labelledby="invitations-heading" className="mt-10">
          <div className="flex items-center gap-2">
            <h2 id="invitations-heading" className="tk-section-title">
              Pending invitations
            </h2>
            {invitations.length > 0 && (
              <span className="tk-badge">{invitations.length}</span>
            )}
          </div>

          <PendingInvitations
            workspaceSlug={workspace.slug}
            invitations={invitations.map((invitation) => ({
              id: invitation.id,
              email: invitation.email,
              expiresAt: invitation.expiresAt.toISOString(),
              isExpired: invitation.isExpired,
            }))}
          />
        </section>
      )}

      <LeaveWorkspace
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        isLastOwner={isOwner && ownerCount <= 1}
      />
    </>
  );
}
