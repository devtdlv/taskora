// Runs the task, project, and comment services against the test database.
// Run with: npm run test:db

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createTestUser, disconnect, prisma, uniqueName } from "../support/database.mjs";

const { createWorkspace } = await import("@/services/workspace.service");
const { createProject, setProjectArchived, updateProject } = await import("@/services/project.service");
const { createTask, deleteTask, moveTask, updateTask, updateTaskStatus } = await import("@/services/task.service");
const { createTaskComment } = await import("@/services/comment.service");
const { createTaskSchema, updateTaskSchema } = await import("@/lib/validations/task");

let owner;
let outsider;
let workspace;

before(async () => {
  owner = await createTestUser("tasks-owner");
  outsider = await createTestUser("tasks-outsider");
  workspace = await createWorkspace(owner.id, { name: uniqueName("Tasks") });
});

after(disconnect);

async function newProject() {
  const project = await createProject(workspace.id, { name: uniqueName("Board") });
  return project;
}

async function addTask(project, title, extra = {}) {
  const result = await createTask(owner.id, workspace.slug, project.slug, createTaskSchema.parse({ title, ...extra }));
  assert.equal(result.ok, true, `Creating ${title} failed.`);
  return result.value;
}

// Each column's titles in saved order, after checking positions run 0, 1, 2...
async function board(project) {
  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { title: true, status: true, position: true },
  });
  const columns = { TODO: [], IN_PROGRESS: [], DONE: [] };

  for (const task of tasks) {
    assert.equal(task.position, columns[task.status].length, `${task.title} is out of place.`);
    columns[task.status].push(task.title);
  }

  return columns;
}

test("new tasks default to MEDIUM priority and join the end of To do", async () => {
  const project = await newProject();
  const first = await addTask(project, "First");
  const second = await addTask(project, "Second", { priority: "URGENT" });

  assert.equal(first.priority, "MEDIUM");
  assert.equal(first.status, "TODO");
  assert.equal(second.priority, "URGENT");
  assert.deepEqual(await board(project), { TODO: ["First", "Second"], IN_PROGRESS: [], DONE: [] });
});

test("status changes move a task to the end of its new column", async () => {
  const project = await newProject();
  const alpha = await addTask(project, "Alpha");
  const bravo = await addTask(project, "Bravo");
  await addTask(project, "Charlie");

  assert.deepEqual(await updateTaskStatus(owner.id, workspace.slug, project.slug, bravo.id, "DONE"), {
    ok: true,
    value: { id: bravo.id, status: "DONE" },
  });
  await updateTaskStatus(owner.id, workspace.slug, project.slug, alpha.id, "DONE");
  await updateTaskStatus(owner.id, workspace.slug, project.slug, alpha.id, "DONE");

  assert.deepEqual(await board(project), { TODO: ["Charlie"], IN_PROGRESS: [], DONE: ["Bravo", "Alpha"] });
});

test("moves reorder within a column and between columns", async () => {
  const project = await newProject();
  const alpha = await addTask(project, "Alpha");
  await addTask(project, "Bravo");
  await addTask(project, "Charlie");
  const delta = await addTask(project, "Delta");

  const toTop = await moveTask(owner.id, workspace.slug, project.slug, delta.id, "TODO", 0);
  assert.deepEqual(toTop, { ok: true, value: { id: delta.id, status: "TODO", position: 0 } });

  // An index past the end of the column puts the task last.
  const across = await moveTask(owner.id, workspace.slug, project.slug, alpha.id, "IN_PROGRESS", 50);
  assert.deepEqual(across, { ok: true, value: { id: alpha.id, status: "IN_PROGRESS", position: 0 } });

  assert.deepEqual(await board(project), { TODO: ["Delta", "Bravo", "Charlie"], IN_PROGRESS: ["Alpha"], DONE: [] });
});

test("deleting the first, middle, and last tasks closes the gaps", async () => {
  const project = await newProject();
  const tasks = [];

  for (const title of ["T1", "T2", "T3", "T4", "T5"]) {
    tasks.push(await addTask(project, title));
  }

  for (const index of [0, 2, 4]) {
    assert.deepEqual(await deleteTask(owner.id, workspace.slug, project.slug, tasks[index].id), { ok: true, value: true });
  }

  assert.deepEqual(await deleteTask(owner.id, workspace.slug, project.slug, tasks[0].id), { ok: true, value: false });
  assert.deepEqual(await board(project), { TODO: ["T2", "T4"], IN_PROGRESS: [], DONE: [] });
});

test("task writes are limited to members and to the task's own project", async () => {
  const project = await newProject();
  const other = await newProject();
  const task = await addTask(project, "Mine");
  const input = createTaskSchema.parse({ title: "Intruder" });

  assert.deepEqual(await createTask(outsider.id, workspace.slug, project.slug, input), { ok: false, error: "NOT_FOUND" });
  assert.deepEqual(await moveTask(outsider.id, workspace.slug, project.slug, task.id, "DONE", 0), { ok: false, error: "NOT_FOUND" });
  assert.deepEqual(await deleteTask(outsider.id, workspace.slug, project.slug, task.id), { ok: false, error: "NOT_FOUND" });

  // A task ID from one project matches nothing through another project.
  assert.deepEqual(await moveTask(owner.id, workspace.slug, other.slug, task.id, "DONE", 0), { ok: true, value: null });
  assert.deepEqual(await deleteTask(owner.id, workspace.slug, other.slug, task.id), { ok: true, value: false });

  assert.deepEqual(await board(project), { TODO: ["Mine"], IN_PROGRESS: [], DONE: [] });
});

test("archived projects refuse every task write until restored", async () => {
  const project = await newProject();
  const task = await addTask(project, "Kept");
  const archived = { ok: false, error: "PROJECT_ARCHIVED" };

  assert.equal(await setProjectArchived(owner.id, workspace.slug, project.slug, true), true);

  assert.deepEqual(await createTask(owner.id, workspace.slug, project.slug, createTaskSchema.parse({ title: "New" })), archived);
  assert.deepEqual(await updateTask(owner.id, workspace.slug, project.slug, task.id, updateTaskSchema.parse({ title: "Renamed" })), archived);
  assert.deepEqual(await updateTaskStatus(owner.id, workspace.slug, project.slug, task.id, "DONE"), archived);
  assert.deepEqual(await moveTask(owner.id, workspace.slug, project.slug, task.id, "DONE", 0), archived);
  assert.deepEqual(await deleteTask(owner.id, workspace.slug, project.slug, task.id), archived);
  assert.deepEqual(await createTaskComment(owner.id, workspace.slug, project.slug, task.id, "Hello"), archived);
  assert.deepEqual(await updateProject(owner.id, workspace.slug, project.slug, { name: "Renamed", description: null }), archived);

  assert.deepEqual(await board(project), { TODO: ["Kept"], IN_PROGRESS: [], DONE: [] });
  assert.equal(await prisma.taskComment.count({ where: { taskId: task.id } }), 0);

  assert.equal(await setProjectArchived(owner.id, workspace.slug, project.slug, false), true);
  await addTask(project, "After restore");
  assert.deepEqual(await board(project), { TODO: ["Kept", "After restore"], IN_PROGRESS: [], DONE: [] });
});

test("concurrent moves, deletes, and creates keep every column consistent", async () => {
  const project = await newProject();
  const tasks = [];

  for (let i = 0; i < 8; i++) {
    tasks.push(await addTask(project, `R${i}`));
  }

  const statuses = ["TODO", "IN_PROGRESS", "DONE"];
  const deleted = tasks.slice(0, 2);
  const writes = [
    ...deleted.map((task) => deleteTask(owner.id, workspace.slug, project.slug, task.id)),
    ...tasks.map((task, i) => moveTask(owner.id, workspace.slug, project.slug, task.id, statuses[i % 3], i % 2)),
    createTask(owner.id, workspace.slug, project.slug, createTaskSchema.parse({ title: "C1" })),
    createTask(owner.id, workspace.slug, project.slug, createTaskSchema.parse({ title: "C2" })),
  ];

  const results = await Promise.all(writes);
  assert.ok(results.every((result) => result.ok), "Every write should reach the active project.");

  const columns = await board(project);
  const expected = [...tasks.slice(2).map((task) => task.title), "C1", "C2"].sort();
  assert.deepEqual(Object.values(columns).flat().sort(), expected);
});
