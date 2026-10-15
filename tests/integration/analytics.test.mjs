// Runs the project analytics service against the test database.
// Run with: npm run test:db

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createTestUser, disconnect, prisma, uniqueName } from "../support/database.mjs";

const { createWorkspace } = await import("@/services/workspace.service");
const { createProject, setProjectArchived } = await import("@/services/project.service");
const { createTask, updateTaskStatus } = await import("@/services/task.service");
const { getProjectAnalytics } = await import("@/services/analytics.service");
const { createTaskSchema } = await import("@/lib/validations/task");

let owner;
let outsider;
let workspace;

before(async () => {
  owner = await createTestUser("analytics-owner");
  outsider = await createTestUser("analytics-outsider");
  workspace = await createWorkspace(owner.id, { name: uniqueName("Analytics") });
});

after(disconnect);

async function newProject(ws = workspace, user = owner) {
  const project = await createProject(ws.id, { name: uniqueName("Metrics") });
  return { ...project, workspace: ws, user };
}

async function addTask(project, title, { status, priority } = {}) {
  const { workspace: ws, user } = project;
  const result = await createTask(user.id, ws.slug, project.slug, createTaskSchema.parse({ title, priority }));
  assert.equal(result.ok, true, `Creating ${title} failed.`);

  if (status && status !== "TODO") {
    await updateTaskStatus(user.id, ws.slug, project.slug, result.value.id, status);
  }

  return result.value;
}

const analyticsFor = (project, user = owner) => getProjectAnalytics(user.id, project.workspace.slug, project.slug);

test("status counts, priority breakdown, and completion come from the saved tasks", async () => {
  const project = await newProject();
  await addTask(project, "Alpha", { priority: "LOW" });
  await addTask(project, "Bravo", { priority: "URGENT" });
  await addTask(project, "Charlie", { status: "IN_PROGRESS", priority: "HIGH" });
  await addTask(project, "Delta", { status: "DONE", priority: "MEDIUM" });
  await addTask(project, "Echo", { status: "DONE", priority: "HIGH" });

  const result = await analyticsFor(project);

  assert.equal(result.project.id, project.id);
  assert.deepEqual(result.analytics, {
    total: 5,
    byStatus: { TODO: 2, IN_PROGRESS: 1, DONE: 2 },
    byPriority: { LOW: 1, MEDIUM: 1, HIGH: 2, URGENT: 1 },
    completionPercent: 40,
  });
});

test("an empty project reports zero tasks and 0% complete", async () => {
  const project = await newProject();

  assert.deepEqual((await analyticsFor(project)).analytics, {
    total: 0,
    byStatus: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    completionPercent: 0,
  });
});

test("counts only cover the requested project, and outsiders get nothing", async () => {
  const project = await newProject();
  await addTask(project, "Mine", { status: "DONE" });

  const sibling = await newProject();
  await addTask(sibling, "Sibling one");
  await addTask(sibling, "Sibling two");

  const otherOwner = await createTestUser("analytics-other");
  const otherWorkspace = await createWorkspace(otherOwner.id, { name: uniqueName("Elsewhere") });
  const foreign = await newProject(otherWorkspace, otherOwner);
  await addTask(foreign, "Foreign task");

  const result = await analyticsFor(project);
  assert.equal(result.analytics.total, 1);
  assert.equal(result.analytics.completionPercent, 100);

  assert.equal(await analyticsFor(project, outsider), null, "A non-member can't read the project.");
  assert.equal(await analyticsFor(foreign, owner), null, "Membership elsewhere doesn't grant access.");
  assert.equal(
    await getProjectAnalytics(owner.id, otherWorkspace.slug, project.slug),
    null,
    "A project is only found under its own workspace.",
  );
  assert.equal(await getProjectAnalytics(owner.id, workspace.slug, uniqueName("missing")), null);
});

test("archived projects stay visible to their workspace", async () => {
  const project = await newProject();
  await addTask(project, "Shipped", { status: "DONE", priority: "HIGH" });
  await addTask(project, "Dropped", { priority: "LOW" });
  assert.equal(await setProjectArchived(owner.id, workspace.slug, project.slug, true), true);

  const result = await analyticsFor(project);
  assert.notEqual(result.project.archivedAt, null);
  assert.equal(result.analytics.total, 2);
  assert.equal(result.analytics.completionPercent, 50);
  assert.equal(await analyticsFor(project, outsider), null);
});

test("reading analytics changes no task or project data", async () => {
  const project = await newProject();
  await addTask(project, "Steady", { status: "IN_PROGRESS" });
  await addTask(project, "Still", { priority: "URGENT" });

  const snapshot = async () => ({
    project: await prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
    tasks: await prisma.task.findMany({ where: { projectId: project.id }, orderBy: { id: "asc" } }),
  });

  const before = await snapshot();
  await analyticsFor(project);
  await analyticsFor(project);
  await analyticsFor(project, outsider);

  assert.deepEqual(await snapshot(), before);
});
