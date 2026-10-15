// A missing or inaccessible project or task must answer with a real 404
// status. Next.js commits to 200 as soon as a loading.tsx fallback streams, so
// each lookup has to run in a layout with no loading boundary above it.
// Run with: npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const WORKSPACE_DIR = join(import.meta.dirname, "..", "src", "app", "workspaces", "[slug]");
const PROJECT_DIR = join(WORKSPACE_DIR, "projects", "[projectSlug]");
const TASK_DIR = join(PROJECT_DIR, "tasks", "[taskId]");

test("the project and task layouts reject missing records before streaming", () => {
  for (const [dir, lookup] of [
    [PROJECT_DIR, /getWorkspaceProject\(/],
    [TASK_DIR, /getProjectTask\(/],
  ]) {
    const source = readFileSync(join(dir, "layout.tsx"), "utf8");

    assert.match(source, lookup);
    assert.match(source, /notFound\(\)/);
  }
});

test("no loading boundary wraps the project or task layout", () => {
  const ancestors = [
    WORKSPACE_DIR,
    join(WORKSPACE_DIR, "projects"),
    PROJECT_DIR,
    join(PROJECT_DIR, "tasks"),
  ];

  for (const dir of ancestors) {
    assert.ok(
      !existsSync(join(dir, "loading.tsx")),
      `${dir} has a loading.tsx, which makes 404s below it return 200. Move it into a route group.`,
    );
  }
});
