// Covers the project analytics calculations. No database is needed.
// Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const { completionPercent, summarizeTaskCounts } = await import("@/lib/analytics");

test("completion is done over total, rounded down, and 0% for empty projects", () => {
  assert.equal(completionPercent(0, 0), 0);
  assert.equal(completionPercent(0, 5), 0);
  assert.equal(completionPercent(2, 5), 40);
  assert.equal(completionPercent(2, 3), 66);
  assert.equal(completionPercent(199, 200), 99, "100% is only shown once every task is done.");
  assert.equal(completionPercent(7, 7), 100);
});

test("grouped counts fold into status and priority totals", () => {
  const summary = summarizeTaskCounts([
    { status: "TODO", priority: "LOW", count: 2 },
    { status: "TODO", priority: "URGENT", count: 1 },
    { status: "IN_PROGRESS", priority: "MEDIUM", count: 3 },
    { status: "DONE", priority: "MEDIUM", count: 1 },
    { status: "DONE", priority: "HIGH", count: 3 },
  ]);

  assert.deepEqual(summary, {
    total: 10,
    byStatus: { TODO: 3, IN_PROGRESS: 3, DONE: 4 },
    byPriority: { LOW: 2, MEDIUM: 4, HIGH: 3, URGENT: 1 },
    completionPercent: 40,
  });
});

test("an empty project reports zeros for every status and priority", () => {
  assert.deepEqual(summarizeTaskCounts([]), {
    total: 0,
    byStatus: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    completionPercent: 0,
  });
});
