// Checks for persistent task ordering and drag and drop. The validation tests
// run the real move schema, transpiled with the project's own TypeScript. The
// rest are static checks on the migration, services, and board: they guard
// against regressions, but they don't execute the services or the browser
// behavior, because that needs a running app and database.
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

// The body of one function, up to the next top-level function or export.
function body(source, name) {
  const start = source.search(new RegExp(`(export )?async function ${name}[(<]`));
  assert.notEqual(start, -1, `${name} not found.`);
  const rest = source.slice(start + 1);
  const next = rest.search(/\n(export |async function |function |const |type )/);
  return source.slice(start, next === -1 ? undefined : start + 1 + next);
}

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
  return import(
    transpile("validations-task", read("lib", "validations", "task.ts"), {
      "@/generated/prisma/enums": enums,
    })
  );
}

test("move payloads are validated strictly", async () => {
  const { moveTaskSchema } = await loadTaskValidation();

  for (const status of ["TODO", "IN_PROGRESS", "DONE"]) {
    assert.deepEqual(moveTaskSchema.parse({ status, index: 0 }), { status, index: 0 });
  }

  const invalid = [
    {},
    { status: "TODO" },
    { index: 1 },
    { status: "BLOCKED", index: 0 },
    { status: "TODO", index: -1 },
    { status: "TODO", index: 1.5 },
    { status: "TODO", index: "2" },
    { status: "TODO", index: 10_001 },
    { status: "TODO", index: 0, projectId: "other" },
    { status: "TODO", index: 0, position: 3 },
  ];

  for (const payload of invalid) {
    assert.equal(moveTaskSchema.safeParse(payload).success, false, `${JSON.stringify(payload)} was accepted.`);
  }
});

test("the migration backfills positions in the existing board order", () => {
  const dir = join(ROOT, "prisma", "migrations");
  const migration = readdirSync(dir).find((name) => name.endsWith("_add_task_position"));
  assert.ok(migration, "Migration not found.");

  const sql = readFileSync(join(dir, migration, "migration.sql"), "utf8");
  const add = sql.indexOf('ADD COLUMN "position" INTEGER;');
  const backfill = sql.search(/ROW_NUMBER\(\) OVER \(\s*PARTITION BY "projectId", "status"\s*ORDER BY "createdAt", "id"\s*\)/);
  const required = sql.indexOf('ALTER COLUMN "position" SET NOT NULL');

  assert.ok(add !== -1 && backfill > add && required > backfill, "Add, backfill, then require the column.");
  assert.match(sql, /CREATE INDEX "tasks_projectId_status_position_idx" ON "tasks"\("projectId", "status", "position"\);/);
  assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE/);

  const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
  assert.match(schema, /position\s+Int\r?\n/);
  assert.match(schema, /@@index\(\[projectId, status, position\]\)/);
});

test("ordering writes hold the order lock and stay inside the project", () => {
  const lock = read("services", "project-lock.ts");
  assert.match(body(lock, "lockTaskOrder"), /pg_advisory_xact_lock\(\$\{TASK_ORDER_LOCK_NAMESPACE\}/);
  assert.match(lock, /TASK_ORDER_LOCK_NAMESPACE = (?!7301)\d+/, "The order lock needs its own namespace.");

  const source = read("services", "task.service.ts");

  const create = body(source, "createTask");
  assert.ok(create.indexOf("writeToActiveProject(") < create.indexOf("lockTaskOrder("));
  assert.ok(create.indexOf("lockTaskOrder(") < create.indexOf("_max: { position: true }"), "Read the last position under the lock.");
  assert.match(create, /status: "TODO"/);
  assert.match(create, /position: \(last\._max\.position \?\? -1\) \+ 1/);

  const place = body(source, "placeTask");
  const locked = place.indexOf("lockTaskOrder(");
  assert.ok(locked !== -1 && locked < place.indexOf("findFirst("), "Lock before reading the order.");
  assert.match(place, /where: \{ id: taskId, projectId \}/);
  assert.match(place, /updateMany\(\{\s*where: \{ id: taskId, projectId \}/);

  assert.match(body(source, "columnTaskIds"), /where: \{ projectId, status \}/);
  assert.match(body(source, "saveColumnOrder"), /t\."projectId" = \$\{projectId\}/);

  assert.match(body(source, "moveTask"), /writeToActiveProject\([\s\S]*placeTask\(tx, project\.id, taskId, status, index\)/);
  assert.match(body(source, "updateTaskStatus"), /placeTask\(tx, project\.id, taskId, status, null\)/);

  const usesOrderLock = source.match(/lockTaskOrder\(/g).length;
  assert.equal(usesOrderLock, 3, "Only createTask, placeTask, and deleteTask take the order lock.");
});

test("deleting a task closes the gap in its column", () => {
  const remove = body(read("services", "task.service.ts"), "deleteTask");

  const steps = [
    "writeToActiveProject(",
    "lockTaskOrder(tx, project.id)",
    "findFirst(",
    "deleteMany(",
    "saveColumnOrder(",
  ].map((step) => remove.indexOf(step));

  assert.ok(steps.every((index) => index !== -1), "Missing a step in deleteTask.");
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), "Lock, read the status, delete, then renumber.");
  assert.match(remove, /where: \{ id: taskId, projectId: project\.id \}/);
  assert.match(remove, /deleteMany\(\{\s*where: \{\s*id: taskId,\s*projectId: project\.id,?\s*\}/);
  assert.match(remove, /columnTaskIds\(tx, project\.id, task\.status\)/);
});

test("the board reads tasks in saved order", () => {
  const source = read("services", "task.service.ts");
  assert.match(source, /const COLUMN_ORDER[^=]*= \[\s*\{ position: "asc" \},\s*\{ createdAt: "asc" \},\s*\{ id: "asc" \},?\s*\]/);
  assert.match(body(source, "getProjectTasks"), /orderBy: COLUMN_ORDER/);
});

test("the move route follows the API conventions", () => {
  const route = read("app", "api", "workspaces", "[slug]", "projects", "[projectSlug]", "tasks", "[taskId]", "move", "route.ts");

  assert.ok(route.indexOf("rejectUntrustedMutation(request, { jsonBody: true })") < route.indexOf("requireVerifiedApiUser("));
  assert.ok(route.indexOf("requireVerifiedApiUser(") < route.indexOf("moveTaskSchema.safeParse("));
  assert.match(route, /projectArchivedResponse\(\)/);
  assert.match(route, /error: "NOT_FOUND"/);
  assert.match(route, /error: "INTERNAL_SERVER_ERROR"/);
  assert.doesNotMatch(route, /error\.message|String\(error\)/, "Database errors must not reach the response.");
});

test("drag and drop keeps keyboard, screen reader, and status select support", () => {
  const board = read("app", "workspaces", "[slug]", "projects", "[projectSlug]", "(board)", "kanban-board.tsx");

  assert.match(board, /useSensor\(KeyboardSensor, \{\s*coordinateGetter: sortableKeyboardCoordinates/);
  assert.match(board, /useSensor\(PointerSensor/);
  assert.match(board, /screenReaderInstructions: \{ draggable: SCREEN_READER_INSTRUCTIONS \}/);
  assert.match(board, /announcements,/);
  assert.match(board, /aria-label=\{`Move \$\{task\.title\}`\}/);
  assert.match(board, /touch-none/);
  assert.match(board, /aria-label=\{`Status for \$\{task\.title\}`\}/);
  assert.match(board, /disabled: readOnly \|\| isBusy/);

  const save = body(board, "saveMove");
  assert.match(save, /\/move`/);
  assert.ok((save.match(/setDraft\(null\)/g) ?? []).length >= 3, "Every outcome must clear the draft board.");
  assert.match(save, /The board was restored\./);
});
