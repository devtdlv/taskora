// Runs the signup, login, and password reset services against the test
// database. Run with: npm run test:db

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { disconnect, prisma, uniqueName } from "../support/database.mjs";

const { createUser, verifyCredentials } = await import("@/services/auth.service");
const { requestPasswordReset, resetPassword } = await import("@/services/password-reset.service");
const { loginSchema, signupSchema } = await import("@/lib/validations/auth");
const { generateHashedToken } = await import("@/lib/token");

const PASSWORD = "Correct-Horse-1";

after(disconnect);

async function signUp(password = PASSWORD) {
  const email = `${uniqueName("auth")}@example.invalid`;
  const user = await createUser(
    signupSchema.parse({ name: "Auth Test", email: email.toUpperCase(), password, confirmPassword: password, terms: true }),
  );
  return { ...user, password };
}

const login = (email, password) => verifyCredentials(loginSchema.parse({ email, password, remember: false }));

async function issueResetToken(user, overrides = {}) {
  const { token, tokenHash } = generateHashedToken();
  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: "PASSWORD_RESET",
      tokenHash,
      email: user.email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ...overrides,
    },
  });
  return token;
}

test("signup stores a bcrypt hash, normalizes the email, and rejects duplicates", async () => {
  const user = await signUp();
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  assert.equal(user.email, user.email.toLowerCase());
  assert.equal("passwordHash" in user, false, "The created user must not expose the hash.");
  assert.match(row.passwordHash, /^\$2b\$12\$/);
  assert.equal(row.passwordHash.includes(PASSWORD), false);

  await assert.rejects(
    createUser(signupSchema.parse({ name: "Again", email: user.email, password: PASSWORD, confirmPassword: PASSWORD, terms: true })),
    /EMAIL_ALREADY_EXISTS/,
  );
});

test("login only succeeds with the right password and never returns the hash", async () => {
  const user = await signUp();

  assert.deepEqual(await login(user.email, PASSWORD), { id: user.id, name: user.name, email: user.email });
  assert.equal(await login(user.email, "Wrong-Password-1"), null);
  assert.equal(await login(`${uniqueName("nobody")}@example.invalid`, PASSWORD), null);
});

test("a reset token changes the password once and signs out every session", async () => {
  const user = await signUp();
  await prisma.session.create({
    data: { id: uniqueName("session"), userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
  });
  const token = await issueResetToken(user);

  assert.equal(await resetPassword(token, "New-Password-22"), true);
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
  assert.equal(await login(user.email, PASSWORD), null);
  assert.equal((await login(user.email, "New-Password-22"))?.id, user.id);

  assert.equal(await resetPassword(token, "Third-Password-3"), false, "Tokens are single use.");
});

test("expired, unknown, and stale reset tokens are refused", async () => {
  const user = await signUp();
  const expired = await issueResetToken(user, { expiresAt: new Date(Date.now() - 1000) });
  const stale = await issueResetToken(user, { email: `${uniqueName("old")}@example.invalid` });

  assert.equal(await resetPassword(expired, "New-Password-22"), false);
  assert.equal(await resetPassword(stale, "New-Password-22"), false, "A token sent to an earlier address must not work.");
  assert.equal(await resetPassword(generateHashedToken().token, "New-Password-22"), false);
  assert.equal((await login(user.email, PASSWORD))?.id, user.id);
});

test("requesting a reset stores only a hash and sends no email in tests", async () => {
  const user = await signUp();

  // The email module logs the refused send; keep the test output quiet.
  const originalError = console.error;
  console.error = () => {};

  try {
    assert.deepEqual(await requestPasswordReset(user.email), { status: "failed", error: "NOT_CONFIGURED" });
  } finally {
    console.error = originalError;
  }

  const tokens = await prisma.authToken.findMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });
  assert.equal(tokens.length, 1);
  assert.match(tokens[0].tokenHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(await requestPasswordReset(`${uniqueName("nobody")}@example.invalid`), { status: "not-found" });
});
