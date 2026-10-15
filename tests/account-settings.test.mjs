// Covers the account settings validation and the email status shown on the
// settings page. No database or network is needed.
// Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { changePasswordSchema, updateProfileSchema } = await import("@/lib/validations/auth");
const { EmailStatus } = await import("@/app/settings/email-status");

test("display names are trimmed and must be 2 to 100 characters", () => {
  assert.deepEqual(updateProfileSchema.parse({ name: "  Ada Lovelace  " }), { name: "Ada Lovelace" });
  assert.equal(updateProfileSchema.parse({ name: "x".repeat(100) }).name.length, 100);

  for (const name of ["", "   ", " A ", "x".repeat(101), 42, null]) {
    assert.equal(updateProfileSchema.safeParse({ name }).success, false, `${JSON.stringify(name)} was accepted.`);
  }

  assert.equal(updateProfileSchema.safeParse({}).success, false);
  assert.equal(
    updateProfileSchema.safeParse({ name: "Ada", email: "other@example.invalid" }).success,
    false,
    "Only the name can be changed here.",
  );
});

test("a new password must be confirmed, valid, and different from the current one", () => {
  const valid = { currentPassword: "Old-Password-1", newPassword: "New-Password-2", confirmNewPassword: "New-Password-2" };
  const fieldErrors = (input) => changePasswordSchema.safeParse(input).error?.flatten().fieldErrors;

  assert.equal(changePasswordSchema.safeParse(valid).success, true);

  assert.ok(fieldErrors({ ...valid, currentPassword: "" }).currentPassword);
  assert.ok(fieldErrors({ ...valid, confirmNewPassword: "New-Password-3" }).confirmNewPassword);
  assert.ok(fieldErrors({ ...valid, newPassword: "short", confirmNewPassword: "short" }).newPassword);
  assert.ok(fieldErrors({ ...valid, newPassword: valid.currentPassword, confirmNewPassword: valid.currentPassword }).newPassword);

  // 19 emoji are 76 bytes, past what bcrypt reads.
  const emoji = "😀".repeat(19);
  assert.ok(fieldErrors({ ...valid, newPassword: emoji, confirmNewPassword: emoji }).newPassword);

  assert.equal(changePasswordSchema.safeParse({ ...valid, userId: "someone-else" }).success, false);
});

test("the settings page shows whether the email is verified", () => {
  const verified = renderToStaticMarkup(createElement(EmailStatus, { email: "ada@example.invalid", verified: true }));
  assert.match(verified, /ada@example\.invalid/);
  assert.match(verified, />Verified</);
  assert.doesNotMatch(verified, /Not verified|Verify your email/);

  const unverified = renderToStaticMarkup(createElement(EmailStatus, { email: "ada@example.invalid", verified: false }));
  assert.match(unverified, />Not verified</);
  assert.match(unverified, /href="\/verify-email\?next=%2Fsettings"[^>]*>Verify your email</);
});
