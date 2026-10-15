// A missing or inaccessible project must answer with a real 404 status. Next.js
// commits to 200 as soon as a loading.tsx fallback streams, so the project
// check has to run in a layout with no loading boundary above it.
// Run with: npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const WORKSPACE_DIR = join(import.meta.dirname, "..", "src", "app", "workspaces", "[slug]");
const PROJECT_DIR = join(WORKSPACE_DIR, "projects", "[projectSlug]");

test("the project layout rejects missing projects before streaming", () => {
  const source = readFileSync(join(PROJECT_DIR, "layout.tsx"), "utf8");

  assert.match(source, /getWorkspaceProject\(/);
  assert.match(source, /notFound\(\)/);
});

test("no loading boundary wraps the project layout", () => {
  for (const dir of [WORKSPACE_DIR, join(WORKSPACE_DIR, "projects")]) {
    assert.ok(
      !existsSync(join(dir, "loading.tsx")),
      `${dir} has a loading.tsx, which makes project 404s return 200. Move it into a route group.`,
    );
  }
});
