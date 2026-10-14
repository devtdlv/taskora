// Checks for task priorities. The validation tests run the real schemas,
// transpiled with the project's own TypeScript. The rest are static checks on
// the source and migration: they guard against regressions, but they don't
// execute the services, because that needs a running app and database.
// Run with: npm test

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const CACHE = join(ROOT, "node_modules", ".cache", "taskora-tests");
const read = (...parts) => readFileSync(join(SRC, ...parts), "utf8");

function exported(source, name) {
  const start = source.search(new RegExp(`export async function ${name}[(<]`));
  assert.notEqual(start, -1, `${name} not found.`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

// Transpiles a module into node_modules/.cache so bare imports such as "zod"
// resolve from the project. Local imports are rewritten through `imports`.
function transpile(name, source, imports = {}) {
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  for (const [specifier, url] of Object.entries(imports)) {
    outputText = outputText.replaceAll(`"${specifier}"`, `"${url}"`);
  }

  const file = join(CACHE, `${name}.mjs`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, outputText);
  return pathToFileURL(file).href;
}

async function loadTaskValidation() {
  const enums = transpile("generated-enums", read("generated", "prisma", "enums.ts"));
  const url = transpile("validations-task", read("lib", "validations", "task.ts"), {
    "@/generated/prisma/enums": enums,
  });
  return import(url);
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const VALID_TASK = { title: "Ship it", description: "", dueDate: "" };

test("new tasks default to MEDIUM and accept each valid priority", async () => {
  const { createTaskSchema } = await loadTaskValidation();

  assert.equal(createTaskSchema.parse(VALID_TASK).priority, "MEDIUM");

  for (const priority of PRIORITIES) {
    assert.equal(createTaskSchema.parse({ ...VALID_TASK, priority }).priority, priority);
  }
});

test("invalid priorities are rejected on create and edit", async () => {
  const { createTaskSchema, updateTaskSchema } = await loadTaskValidation();

  for (const priority of ["CRITICAL", "low", "", 2, null]) {
    for (const schema of [createTaskSchema, updateTaskSchema]) {
      const result = schema.safeParse({ ...VALID_TASK, priority });
      assert.equal(result.success, false, `${JSON.stringify(priority)} was accepted.`);
      assert.ok(result.error.flatten().fieldErrors.priority, "The error must name the priority field.");
    }
  }
});

test("edits accept each priority and leave it unchanged when omitted", async () => {
  const { updateTaskSchema } = await loadTaskValidation();

  for (const priority of PRIORITIES) {
    assert.equal(updateTaskSchema.parse({ ...VALID_TASK, priority }).priority, priority);
  }

  assert.equal(updateTaskSchema.parse(VALID_TASK).priority, undefined);
  assert.equal(updateTaskSchema.safeParse({ ...VALID_TASK, status: "DONE" }).success, false);
});

test("the enum has exactly four values and existing tasks default to MEDIUM", () => {
  const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
  const values = schema.match(/enum TaskPriority \{([^}]*)\}/)?.[1].trim().split(/\s+/);
  assert.deepEqual(values, PRIORITIES);
  assert.match(schema, /priority\s+TaskPriority\s+@default\(MEDIUM\)/);

  const dir = join(ROOT, "prisma", "migrations");
  const migration = readdirSync(dir).find((name) => name.endsWith("_add_task_priority"));
  assert.ok(migration, "Migration not found.");

  const sql = readFileSync(join(dir, migration, "migration.sql"), "utf8");
  assert.match(sql, /CREATE TYPE "TaskPriority" AS ENUM \('LOW', 'MEDIUM', 'HIGH', 'URGENT'\);/);
  assert.match(sql, /ALTER TABLE "tasks" ADD COLUMN\s+"priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';/);
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE|TRUNCATE/);
});

test("priority writes go through the archive check and stay in the project", () => {
  const source = read("services", "task.service.ts");

  for (const name of ["createTask", "updateTask"]) {
    const body = exported(source, name);
    const guarded = body.indexOf("writeToActiveProject(");
    assert.ok(guarded !== -1, `${name} must use writeToActiveProject.`);
    assert.ok(body.indexOf("priority: input.priority") > guarded, `${name} must write priority inside the guarded write.`);
  }

  const update = exported(source, "updateTask");
  assert.match(update, /where:\s*\{\s*id: taskId,\s*projectId: project\.id,?\s*\}/);

  for (const name of ["getProjectTasks", "getProjectTask"]) {
    assert.match(exported(source, name), /priority: true/, `${name} must return priority.`);
  }
});

test("the forms send priority and the labels cover every value", async () => {
  const labels = await import(transpile("lib-task", read("lib", "task.ts")));
  assert.deepEqual(labels.TASK_PRIORITIES, PRIORITIES);
  assert.deepEqual(Object.keys(labels.TASK_PRIORITY_LABELS), PRIORITIES);

  const base = ["app", "workspaces", "[slug]", "projects", "[projectSlug]", "tasks"];
  for (const parts of [["new", "create-task-form.tsx"], ["[taskId]", "task-details.tsx"]]) {
    const form = read(...base, ...parts);
    assert.match(form, /priority: formData\.get\("priority"\)/);
    assert.match(form, /name="priority"/);
  }
});
