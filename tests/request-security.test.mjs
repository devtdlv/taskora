// Runs the real request, redirect, password, and validation helpers, imported
// through tests/support/register.mjs. No database or network is needed.
// Run with: npm test

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const { rejectUntrustedMutation } = await import("@/lib/request");
const { getSafeRedirectPath } = await import("@/lib/redirect");
const { hashPassword, verifyPassword } = await import("@/lib/password");
const { needsEmailVerification } = await import("@/lib/email-verification-policy");
const { loginSchema, resetPasswordSchema, signupSchema } = await import("@/lib/validations/auth");

const savedEnv = { APP_URL: process.env.APP_URL, NODE_ENV: process.env.NODE_ENV, ENFORCE: process.env.ENFORCE_EMAIL_VERIFICATION };

afterEach(() => {
  for (const [key, value] of [
    ["APP_URL", savedEnv.APP_URL],
    ["NODE_ENV", savedEnv.NODE_ENV],
    ["ENFORCE_EMAIL_VERIFICATION", savedEnv.ENFORCE],
  ]) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function mutation(headers) {
  return new Request("http://localhost:3000/api/workspaces", { method: "POST", headers });
}

test("mutations from another origin or without a JSON body are refused", async () => {
  process.env.APP_URL = "https://taskora.example.com";
  const trusted = "https://taskora.example.com";

  assert.equal(rejectUntrustedMutation(mutation({ origin: trusted, "content-type": "application/json" }), { jsonBody: true }), null);
  assert.equal(rejectUntrustedMutation(mutation({ "content-type": "application/json; charset=utf-8" }), { jsonBody: true }), null);
  assert.equal(rejectUntrustedMutation(mutation({ origin: trusted }), { jsonBody: false }), null);

  for (const origin of ["https://evil.example", "null", "", "https://taskora.example.com.evil.example"]) {
    const response = rejectUntrustedMutation(mutation({ origin, "content-type": "application/json" }), { jsonBody: true });
    assert.equal(response?.status, 403, `Origin ${JSON.stringify(origin)} was accepted.`);
    assert.equal((await response.json()).error, "FORBIDDEN");
  }

  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
    const response = rejectUntrustedMutation(mutation({ origin: trusted, "content-type": type }), { jsonBody: true });
    assert.equal(response?.status, 415, `${type} was accepted.`);
  }
});

test("without APP_URL, production refuses browser requests", () => {
  delete process.env.APP_URL;
  process.env.NODE_ENV = "production";
  const originalError = console.error;
  console.error = () => {};

  try {
    const response = rejectUntrustedMutation(mutation({ origin: "http://localhost:3000" }), { jsonBody: false });
    assert.equal(response?.status, 403);
  } finally {
    console.error = originalError;
  }
});

test("redirects after login stay on this site", () => {
  for (const path of ["/dashboard", "/workspaces/acme?tab=members", "/invite/abc#top"]) {
    assert.equal(getSafeRedirectPath(path), path);
  }

  const attacks = [
    undefined,
    ["/dashboard"],
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/%2f%2fevil.example",
    "/%5cevil.example",
    "javascript:alert(1)",
    "dashboard",
  ];

  for (const path of attacks) {
    assert.equal(getSafeRedirectPath(path), "/dashboard", `${JSON.stringify(path)} was allowed.`);
  }
});

test("passwords are hashed with bcrypt and can't exceed 72 bytes", async () => {
  const hash = await hashPassword("Correct-Horse-1");

  assert.match(hash, /^\$2b\$12\$/);
  assert.equal(await verifyPassword("Correct-Horse-1", hash), true);
  assert.equal(await verifyPassword("correct-horse-1", hash), false);
  await assert.rejects(hashPassword("😀".repeat(19)), /PASSWORD_TOO_LONG/);
});

test("signup, login, and reset payloads are validated", () => {
  const signup = { name: "Ada", email: " Ada@Example.COM ", password: "long-enough", confirmPassword: "long-enough", terms: true };

  assert.equal(signupSchema.parse(signup).email, "ada@example.com");
  assert.equal(signupSchema.safeParse({ ...signup, terms: false }).success, false);
  assert.equal(signupSchema.safeParse({ ...signup, confirmPassword: "different" }).success, false);
  assert.equal(signupSchema.safeParse({ ...signup, password: "short", confirmPassword: "short" }).success, false);

  // 19 emoji are 76 bytes, past what bcrypt reads.
  const emoji = "😀".repeat(19);
  assert.equal(signupSchema.safeParse({ ...signup, password: emoji, confirmPassword: emoji }).success, false);

  assert.equal(loginSchema.safeParse({ email: "ada@example.com", password: "x" }).success, false, "remember is required.");
  assert.equal(
    resetPasswordSchema.safeParse({ token: "too-short", password: "long-enough", confirmPassword: "long-enough" }).success,
    false,
  );
});

test("email verification is only enforced when the flag is exactly true", () => {
  const unverified = { emailVerifiedAt: null };

  for (const value of [undefined, "false", "TRUE", "1", "yes"]) {
    if (value === undefined) {
      delete process.env.ENFORCE_EMAIL_VERIFICATION;
    } else {
      process.env.ENFORCE_EMAIL_VERIFICATION = value;
    }
    assert.equal(needsEmailVerification(unverified), false, `Enforced for ${value}.`);
  }

  process.env.ENFORCE_EMAIL_VERIFICATION = "true";
  assert.equal(needsEmailVerification(unverified), true);
  assert.equal(needsEmailVerification({ emailVerifiedAt: new Date() }), false);
});
