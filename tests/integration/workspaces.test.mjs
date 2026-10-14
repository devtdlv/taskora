// Runs the workspace and invitation services against the test database.
// Run with: npm run test:db

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createTestUser, disconnect, prisma, uniqueName } from "../support/database.mjs";

const {
  createWorkspace,
  leaveWorkspace,
  removeWorkspaceMember,
  renameWorkspace,
} = await import("@/services/workspace.service");
const { createProject } = await import("@/services/project.service");
const { createTask } = await import("@/services/task.service");
const {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  revokeWorkspaceInvitation,
} = await import("@/services/invitation.service");

after(disconnect);

// A workspace with an owner and a plain member.
async function team() {
  const owner = await createTestUser("ws-owner");
  const member = await createTestUser("ws-member");
  const workspace = await createWorkspace(owner.id, { name: uniqueName("Team") });
  const membership = await prisma.workspaceMember.create({
    data: { userId: member.id, workspaceId: workspace.id, role: "MEMBER" },
    select: { id: true },
  });
  const ownerMembership = await prisma.workspaceMember.findFirstOrThrow({
    where: { userId: owner.id, workspaceId: workspace.id },
    select: { id: true, role: true },
  });

  return { owner, member, workspace, membershipId: membership.id, ownerMembership };
}

test("creating a workspace makes the creator its owner", async () => {
  const { ownerMembership } = await team();
  assert.equal(ownerMembership.role, "OWNER");
});

test("only owners can rename a workspace, and outsiders can't see it", async () => {
  const { owner, member, workspace } = await team();
  const outsider = await createTestUser("ws-outsider");
  const name = { name: uniqueName("Renamed") };

  assert.deepEqual(await renameWorkspace(outsider.id, workspace.slug, name), { ok: false, error: "NOT_FOUND" });
  assert.deepEqual(await renameWorkspace(member.id, workspace.slug, name), { ok: false, error: "FORBIDDEN" });

  const renamed = await renameWorkspace(owner.id, workspace.slug, name);
  assert.equal(renamed.ok, true);
  assert.equal(renamed.workspace.name, name.name);
});

test("members can't remove people, and the last owner can't leave", async () => {
  const { owner, member, workspace, membershipId, ownerMembership } = await team();

  assert.deepEqual(await removeWorkspaceMember(member.id, workspace.slug, ownerMembership.id), { ok: false, error: "FORBIDDEN" });
  assert.deepEqual(await removeWorkspaceMember(owner.id, workspace.slug, ownerMembership.id), { ok: false, error: "CANNOT_REMOVE_SELF" });
  assert.deepEqual(await leaveWorkspace(owner.id, workspace.slug), { ok: false, error: "LAST_OWNER" });
  assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }), 2);

  assert.deepEqual(await removeWorkspaceMember(owner.id, workspace.slug, membershipId), { ok: true });
});

test("removing a member revokes their access to the workspace's projects", async () => {
  const { owner, member, workspace, membershipId } = await team();
  const project = await createProject(workspace.id, { name: uniqueName("Shared") });
  const input = { title: "From member", description: null, priority: "MEDIUM", dueDate: null };

  assert.equal((await createTask(member.id, workspace.slug, project.slug, input)).ok, true);
  await removeWorkspaceMember(owner.id, workspace.slug, membershipId);
  assert.deepEqual(await createTask(member.id, workspace.slug, project.slug, input), { ok: false, error: "NOT_FOUND" });
});

test("invitations only work for the invited account and are stored hashed", async () => {
  const { workspace } = await team();
  const invitee = await createTestUser("invitee");
  const stranger = await createTestUser("stranger");
  const { token } = await createWorkspaceInvitation(workspace.id, invitee.email);

  const row = await prisma.workspaceInvitation.findFirstOrThrow({ where: { workspaceId: workspace.id, email: invitee.email } });
  assert.notEqual(row.tokenHash, token);
  assert.match(row.tokenHash, /^[0-9a-f]{64}$/);

  assert.deepEqual(await acceptWorkspaceInvitation(stranger, token), { ok: false, error: "EMAIL_MISMATCH" });
  assert.deepEqual(await acceptWorkspaceInvitation(invitee, token), { ok: true, workspaceSlug: workspace.slug });

  const joined = await prisma.workspaceMember.findFirst({ where: { userId: invitee.id, workspaceId: workspace.id } });
  assert.equal(joined?.role, "MEMBER");
  assert.equal(await prisma.workspaceMember.count({ where: { userId: stranger.id, workspaceId: workspace.id } }), 0);

  await assert.rejects(createWorkspaceInvitation(workspace.id, invitee.email), /ALREADY_MEMBER/);
});

test("inviting the same email again invalidates the earlier link", async () => {
  const { workspace } = await team();
  const invitee = await createTestUser("reinvited");
  const first = await createWorkspaceInvitation(workspace.id, invitee.email);
  const second = await createWorkspaceInvitation(workspace.id, invitee.email);

  assert.deepEqual(await acceptWorkspaceInvitation(invitee, first.token), { ok: false, error: "INVALID_INVITATION" });
  assert.deepEqual(await acceptWorkspaceInvitation(invitee, second.token), { ok: true, workspaceSlug: workspace.slug });
});

test("expired invitations can't be accepted", async () => {
  const { workspace } = await team();
  const invitee = await createTestUser("late");
  const { token } = await createWorkspaceInvitation(workspace.id, invitee.email);

  await prisma.workspaceInvitation.updateMany({
    where: { workspaceId: workspace.id, email: invitee.email },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  assert.deepEqual(await acceptWorkspaceInvitation(invitee, token), { ok: false, error: "INVITATION_EXPIRED" });
  assert.equal(await prisma.workspaceMember.count({ where: { userId: invitee.id, workspaceId: workspace.id } }), 0);
});

test("only owners can revoke invitations, and revoked links stop working", async () => {
  const { owner, member, workspace } = await team();
  const outsider = await createTestUser("revoke-outsider");
  const invitee = await createTestUser("revoked");
  const { token } = await createWorkspaceInvitation(workspace.id, invitee.email);
  const { id } = await prisma.workspaceInvitation.findFirstOrThrow({ where: { workspaceId: workspace.id, email: invitee.email } });

  assert.deepEqual(await revokeWorkspaceInvitation(outsider.id, workspace.slug, id), { ok: false, error: "NOT_FOUND" });
  assert.deepEqual(await revokeWorkspaceInvitation(member.id, workspace.slug, id), { ok: false, error: "FORBIDDEN" });
  assert.deepEqual(await revokeWorkspaceInvitation(owner.id, workspace.slug, id), { ok: true });
  assert.deepEqual(await revokeWorkspaceInvitation(owner.id, workspace.slug, id), { ok: false, error: "INVITATION_NOT_FOUND" });

  assert.deepEqual(await acceptWorkspaceInvitation(invitee, token), { ok: false, error: "INVALID_INVITATION" });
});

test("with verification enforced, unverified accounts can't accept invitations", async () => {
  const { workspace } = await team();
  const invitee = await createTestUser("unverified", { verified: false });
  const { token } = await createWorkspaceInvitation(workspace.id, invitee.email);

  process.env.ENFORCE_EMAIL_VERIFICATION = "true";

  try {
    assert.deepEqual(await acceptWorkspaceInvitation(invitee, token), { ok: false, error: "EMAIL_NOT_VERIFIED" });
  } finally {
    process.env.ENFORCE_EMAIL_VERIFICATION = "false";
  }

  assert.equal(await prisma.workspaceMember.count({ where: { userId: invitee.id, workspaceId: workspace.id } }), 0);
});
