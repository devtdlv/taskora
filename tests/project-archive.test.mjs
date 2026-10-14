// Checks for project editing, archiving, and workspace renaming. The slug and
// validation tests run the real modules, transpiled with the project's own
// TypeScript. The rest are static checks on the source: they guard the shape
// of the locking and authorization code against regressions, but they don't
// execute it, because that needs a running app and database.
// Run with: npm test

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const read = (...parts) => readFileSync(join(SRC, ...parts), "utf8");

// The body of one exported function, up to the next top-level export.
function exported(source, name) {
  const start = source.search(new RegExp(`export async function ${name}[(<]`));
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

// Transpiles a module with no local imports into node_modules/.cache, so bare
// imports such as "zod" resolve from the project.
async function load(...parts) {
  const { outputText } = ts.transpileModule(read(...parts), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const dir = join(ROOT, "node_modules", ".cache", "taskora-tests");
  const file = join(dir, `${parts.join("-").replace(/\.ts$/, "")}.mjs`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, outputText);

  return import(pathToFileURL(file).href);
}

test("renamed names keep their slug unless the base slug changes", async () => {
  const { slugify, slugMatchesBase, pickAvailableSlug } = await load("lib", "slug.ts");

  assert.equal(slugify("Website Redesign", "project"), "website-redesign");
  assert.ok(slugMatchesBase("acme", slugify("ACME", "workspace")));
  assert.ok(slugMatchesBase("acme-2", "acme"));
  assert.ok(!slugMatchesBase("acme-corp", "acme"));
  assert.ok(!slugMatchesBase("acme-2x", "acme"));
  assert.equal(pickAvailableSlug("roadmap", ["roadmap", "roadmap-2"]), "roadmap-3");
  assert.equal(pickAvailableSlug("new", []), "new-2");
});

test("edit and rename payloads are validated strictly", async () => {
  const { updateProjectSchema } = await load("lib", "validations", "project.ts");
  const { renameWorkspaceSchema } = await load("lib", "validations", "workspace.ts");

  assert.deepEqual(
    updateProjectSchema.parse({ name: "  Roadmap ", description: "" }),
    { name: "Roadmap", description: null },
  );
  assert.equal(updateProjectSchema.safeParse({ name: "x" }).success, false);
  assert.equal(updateProjectSchema.safeParse({ name: "Roadmap", archivedAt: null }).success, false);
  assert.equal(updateProjectSchema.safeParse({ name: "Roadmap", slug: "other" }).success, false);
  assert.equal(renameWorkspaceSchema.safeParse({ name: "Acme", slug: "x" }).success, false);
  assert.equal(renameWorkspaceSchema.safeParse({ name: "A".repeat(51) }).success, false);
  assert.equal(renameWorkspaceSchema.parse({ name: " Acme " }).name, "Acme");
});

test("the migration only adds the nullable archivedAt column", () => {
  const dir = join(ROOT, "prisma", "migrations");
  const migration = readdirSync(dir).find((name) => name.endsWith("_add_project_archived_at"));
  assert.ok(migration, "Migration not found.");

  const sql = readFileSync(join(dir, migration, "migration.sql"), "utf8");
  assert.match(sql, /ALTER TABLE "projects" ADD COLUMN\s+"archivedAt" TIMESTAMP\(3\);/);
  assert.doesNotMatch(sql, /NOT NULL|DROP|DELETE|UPDATE/);
});

test("the project lock is scoped by membership and re-reads the project once held", () => {
  const source = read("services", "project-lock.ts");
  const lock = exported(source, "lockProject");

  assert.match(lock, /w\."slug" = \$\{workspaceSlug\}/);
  assert.match(lock, /p\."slug" = \$\{projectSlug\}/);
  assert.match(lock, /m\."userId" = \$\{userId\}/);

  const shared = lock.indexOf("pg_advisory_xact_lock_shared(");
  const exclusive = lock.indexOf("pg_advisory_xact_lock(");
  const reread = lock.lastIndexOf('"archivedAt"');
  assert.ok(shared !== -1 && exclusive !== -1, "Writes must lock shared and archives exclusively.");
  assert.ok(reread > shared && reread > exclusive, "archivedAt must be read after the lock is held.");

  const write = exported(source, "writeToActiveProject");
  const locked = write.search(/lockProject\(/);
  assert.ok(write.includes("prisma.$transaction("), "Writes must run in a transaction.");
  assert.ok(locked !== -1 && locked < write.indexOf("project.archivedAt"), "The archive check must follow the lock.");
  assert.ok(write.indexOf('"PROJECT_ARCHIVED"') < write.indexOf("await write("), "Archived projects must be rejected before writing.");
});

test("every task and comment mutation goes through writeToActiveProject", () => {
  const services = {
    "task.service.ts": ["createTask", "updateTaskStatus", "updateTask", "deleteTask", "updateTaskAssignee"],
    "comment.service.ts": ["createTaskComment", "deleteTaskComment"],
  };

  for (const [file, names] of Object.entries(services)) {
    const source = read("services", file);

    for (const name of names) {
      assert.match(exported(source, name), /writeToActiveProject\(/, `${name} must check that the project is active.`);
    }
  }

  // Outside a transaction callback, no service may write tasks or comments.
  for (const file of walk(join(SRC, "services"))) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /prisma\.(task|taskComment)\.(create|update|updateMany|upsert|delete|deleteMany)\(/,
      `${relative(SRC, file)} writes tasks or comments without the project lock.`,
    );
  }
});

test("every task and comment route reports archived projects", () => {
  const dir = join(SRC, "app", "api", "workspaces", "[slug]", "projects", "[projectSlug]", "tasks");
  const handler = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
  let handlers = 0;

  for (const file of walk(dir).filter((f) => f.endsWith("route.ts"))) {
    const source = readFileSync(file, "utf8");
    const count = [...source.matchAll(handler)].length;
    const handled = [...source.matchAll(/projectArchivedResponse\(\)/g)].length;

    handlers += count;
    assert.ok(handled >= count, `${relative(SRC, file)} has ${count} handlers but reports PROJECT_ARCHIVED ${handled} times.`);
  }

  // Create, status, edit, and delete a task; assign it; post and delete comments.
  assert.equal(handlers, 7, "Expected the seven task and comment mutation handlers.");
});

test("project edits lock the row, refuse archived projects, and retry slug collisions", () => {
  const source = read("services", "project.service.ts");
  const update = exported(source, "updateProject");

  assert.match(update, /prisma\.\$transaction\(/);
  assert.match(update, /lockProject\([\s\S]*?"exclusive",?\s*\)/);
  assert.ok(update.search(/lockProject\(/) < update.indexOf("project.archivedAt"));
  assert.ok(update.indexOf('"PROJECT_ARCHIVED"') < update.indexOf("tx.project.update("));
  assert.match(update, /where: \{\s*id: project\.id,/, "The update must target the locked project.");
  assert.match(update, /isProjectSlugTaken\(error\)/, "Slug collisions must be retried.");

  const archive = exported(source, "setProjectArchived");
  assert.match(archive, /lockProject\([\s\S]*?"exclusive",?\s*\)/, "Archiving must wait for writes in progress.");
  assert.match(archive, /where: \{\s*id: project\.id,/, "Archiving must target the locked project.");
  assert.doesNotMatch(archive, /\.delete(Many)?\(/, "Archiving must not delete anything.");
});

test("workspace renames are owner-only and run under the workspace lock", () => {
  const rename = exported(read("services", "workspace.service.ts"), "renameWorkspace");
  const lock = rename.search(/lockWorkspaceMembership\(/);

  assert.ok(lock !== -1 && lock < rename.indexOf('actor.role !== "OWNER"'));
  assert.ok(rename.indexOf('"FORBIDDEN"') < rename.indexOf("tx.workspace.update("));
  assert.match(rename, /id: actor\.workspaceId/, "The update must target the actor's workspace.");
  assert.match(rename, /isWorkspaceSlugTaken\(error\)/, "Slug collisions must be retried.");
});

test("active lists and counts leave archived projects out", () => {
  const projects = read("services", "project.service.ts");
  assert.match(exported(projects, "getWorkspaceProjects"), /archivedAt: null/);
  assert.match(exported(projects, "getArchivedWorkspaceProjects"), /archivedAt: \{\s*not: null/);

  assert.match(
    exported(read("services", "workspace.service.ts"), "getUserWorkspaces"),
    /projects: \{\s*where: \{\s*archivedAt: null/,
  );
  assert.match(exported(read("services", "task.service.ts"), "getOpenTaskCounts"), /archivedAt: null/);
});
