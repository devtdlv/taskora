// Static checks on the source of member and invitation management. They guard
// the shape of the authorization and locking code against regressions, but
// they don't execute it: runtime behavior needs a running app and database.
// Run with: npm test

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const SRC = join(import.meta.dirname, "..", "src");
const read = (...parts) => readFileSync(join(SRC, ...parts), "utf8");

// The body of one exported function, up to the next top-level export.
function exported(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found.`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

test("the workspace lock is taken before membership is read", () => {
  const source = read("services", "workspace-lock.ts");
  const lock = source.indexOf("FOR NO KEY UPDATE");

  assert.ok(lock !== -1, "The workspace row must be locked with FOR NO KEY UPDATE.");
  assert.ok(
    source.indexOf("workspaceMember.findUnique", lock) > lock,
    "Membership must be read in a separate statement after the lock.",
  );
});

test("removing and leaving check ownership and the last owner under the lock", () => {
  const source = read("services", "workspace.service.ts");

  for (const name of ["removeWorkspaceMember", "leaveWorkspace"]) {
    const body = exported(source, name);
    const lock = body.search(/lockWorkspaceMembership\(\s*tx/);
    const owners = body.search(/countOwners\(\s*tx/);
    const remove = body.indexOf("workspaceMember.delete(");

    assert.ok(body.includes("prisma.$transaction("), `${name} must run in a transaction.`);
    assert.ok(lock !== -1 && lock < owners && owners < remove, `${name} must lock, then count owners, then delete.`);
    assert.match(body, /"LAST_OWNER"/, `${name} must refuse to remove the last owner.`);
  }

  const remove = exported(source, "removeWorkspaceMember");
  assert.match(remove, /actor\.role !== "OWNER"/, "Only owners may remove members.");
  assert.match(remove, /workspaceId: actor\.workspaceId/, "The target must belong to the actor's workspace.");
  assert.doesNotMatch(remove, /user\.delete|session\.delete/, "Removal must not delete the user's account or sessions.");
});

test("revoking is owner-only, scoped to the workspace, and only matches pending invitations", () => {
  const body = exported(read("services", "invitation.service.ts"), "revokeWorkspaceInvitation");

  const lock = body.search(/lockWorkspaceMembership\(\s*tx/);
  assert.ok(lock !== -1 && lock < body.indexOf("deleteMany("));
  assert.match(body, /actor\.role !== "OWNER"/);
  assert.match(body, /workspaceId: actor\.workspaceId/);
  assert.match(body, /acceptedAt: null/);
});

test("acceptance only succeeds for a pending invitation that still has the presented token", () => {
  const body = exported(read("services", "invitation.service.ts"), "acceptWorkspaceInvitation");
  const update = body.slice(body.indexOf("workspaceInvitation.updateMany("));

  assert.match(update, /tokenHash: hashToken\(token\)/, "A revoked or replaced token must not match.");
  assert.match(update, /acceptedAt: null/);
  assert.ok(body.indexOf("updateMany(") < body.indexOf("workspaceMember.upsert("), "Membership must only be created after the conditional update.");
});

test("token hashes never reach pages, routes, or components", () => {
  const pending = exported(read("services", "invitation.service.ts"), "getPendingWorkspaceInvitations");
  assert.doesNotMatch(pending, /tokenHash/);

  const files = [...walk(join(SRC, "app")), ...walk(join(SRC, "components"))].filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.length > 0);

  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /tokenHash/, `${relative(SRC, file)} must not touch token hashes.`);
  }
});
