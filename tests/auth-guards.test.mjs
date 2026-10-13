// Fails when a page, layout, or API route reads the session without going
// through the verification guards, so new protected routes can't skip them.
// Run with: npm test

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

const APP_DIR = join(import.meta.dirname, "..", "src", "app");

// Pages that must stay reachable without a verified email. Anything else under
// src/app is treated as protected.
const PUBLIC_ROUTES = new Set([
  "",
  "privacy",
  "terms",
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "verify-email",
  "verify-email/confirm",
  "invite/[token]",
]);

// Endpoints used to sign in, sign up, verify, recover, and sign out.
const PUBLIC_API_PREFIX = "api/auth/";

const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function routeOf(file) {
  return relative(APP_DIR, file).split(sep).slice(0, -1).join("/");
}

const files = walk(APP_DIR);
const pages = files.filter((f) => /[\\/](page|layout)\.tsx$/.test(f));
const apiRoutes = files.filter((f) => /[\\/]route\.ts$/.test(f));

test("every public route in the allowlist still exists", () => {
  for (const route of PUBLIC_ROUTES) {
    assert.ok(
      existsSync(join(APP_DIR, route, "page.tsx")),
      `Allowlisted route "/${route}" has no page.tsx. Update PUBLIC_ROUTES.`,
    );
  }
});

test("protected pages and layouts use requireVerifiedUser", () => {
  const protectedPages = pages.filter((f) => !PUBLIC_ROUTES.has(routeOf(f)));
  assert.ok(protectedPages.length > 0, "No protected pages found.");

  for (const file of protectedPages) {
    const source = readFileSync(file, "utf8");
    const name = relative(APP_DIR, file);

    assert.match(
      source,
      /requireVerifiedUser\(/,
      `${name} must call requireVerifiedUser().`,
    );
    assert.doesNotMatch(
      source,
      /getCurrentUser\(/,
      `${name} must not call getCurrentUser() directly.`,
    );
  }
});

test("protected API handlers use requireVerifiedApiUser", () => {
  const protectedRoutes = apiRoutes.filter(
    (f) => !`${routeOf(f)}/`.startsWith(PUBLIC_API_PREFIX),
  );
  assert.ok(protectedRoutes.length > 0, "No protected API routes found.");

  let handlers = 0;

  for (const file of protectedRoutes) {
    const source = readFileSync(file, "utf8");
    const name = relative(APP_DIR, file);
    const handlerCount = [...source.matchAll(HANDLER)].length;
    const guardCount = [...source.matchAll(/requireVerifiedApiUser\(/g)].length;

    handlers += handlerCount;

    assert.ok(
      guardCount >= handlerCount,
      `${name} has ${handlerCount} handlers but only ${guardCount} requireVerifiedApiUser() calls.`,
    );
    assert.doesNotMatch(
      source,
      /getCurrentUser\(/,
      `${name} must not call getCurrentUser() directly.`,
    );
  }

  assert.ok(handlers >= 11, `Expected at least 11 protected handlers, found ${handlers}.`);
});

test("invitation acceptance checks verification in the service", () => {
  const source = readFileSync(
    join(APP_DIR, "..", "services", "invitation.service.ts"),
    "utf8",
  );
  const accept = source.slice(source.indexOf("export async function acceptWorkspaceInvitation"));

  assert.match(accept, /lockUser\(/, "Acceptance must read the account under lock.");
  assert.match(
    accept,
    /needsEmailVerification\(/,
    "Acceptance must check email verification itself.",
  );
});

test("client calls to protected APIs handle EMAIL_NOT_VERIFIED", () => {
  const clientFiles = files.filter(
    (f) => f.endsWith(".tsx") && readFileSync(f, "utf8").startsWith('"use client"'),
  );
  let calls = 0;

  for (const file of clientFiles) {
    const source = readFileSync(file, "utf8");
    const callCount = [...source.matchAll(/fetch\(\s*[`"'](?!\/api\/auth\/)/g)].length;
    const handledCount = [...source.matchAll(/"EMAIL_NOT_VERIFIED"/g)].length;

    calls += callCount;

    assert.ok(
      handledCount >= callCount,
      `${relative(APP_DIR, file)} makes ${callCount} protected API calls but handles EMAIL_NOT_VERIFIED ${handledCount} times.`,
    );
  }

  assert.ok(calls >= 11, `Expected at least 11 protected client calls, found ${calls}.`);
});

test("the invite page keeps its token out of the verify-email next parameter", () => {
  const source = readFileSync(join(APP_DIR, "invite", "[token]", "page.tsx"), "utf8");

  assert.doesNotMatch(source, /verifyEmailPath|\/verify-email\?/);
});
