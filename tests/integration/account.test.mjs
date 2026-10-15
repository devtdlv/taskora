// Calls the account settings route handlers against the test database, with
// the session cookie supplied through tests/support/next-headers.mjs.
// Run with: npm run test:db

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, afterEach, before, test } from "node:test";

import { disconnect, prisma, uniqueName } from "../support/database.mjs";
import { setRequestCookies } from "../support/next-headers.mjs";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "Correct-Horse-1";
const NEW_PASSWORD = "Battery-Staple-2";

const savedEnv = {
  APP_URL: process.env.APP_URL,
  RATE_LIMIT_SECRET: process.env.RATE_LIMIT_SECRET,
};
process.env.APP_URL = ORIGIN;
process.env.RATE_LIMIT_SECRET = "test-only-rate-limit-secret-not-used-anywhere-else";

const profileRoute = await import("@/app/api/account/profile/route");
const passwordRoute = await import("@/app/api/account/password/route");
const otherSessionsRoute = await import("@/app/api/account/other-sessions/route");
const { changePassword } = await import("@/services/account.service");
const { hashPassword, verifyPassword } = await import("@/lib/password");
const { generateHashedToken } = await import("@/lib/token");

// consumeRateLimit occasionally schedules cleanup with after(), which only
// works inside a Next.js request.
const originalRandom = Math.random;
before(() => {
  Math.random = () => 0.5;
});

afterEach(() => {
  setRequestCookies();
  process.env.ENFORCE_EMAIL_VERIFICATION = "false";
});

after(async () => {
  Math.random = originalRandom;

  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await disconnect();
});

async function createAccount(tag, { verified = true } = {}) {
  return prisma.user.create({
    data: {
      name: `Account ${tag}`,
      email: `${uniqueName(tag)}@example.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: verified ? new Date() : null,
    },
    select: { id: true, name: true },
  });
}

async function signIn(user, { expiresInMs = 60 * 60 * 1000 } = {}) {
  const token = randomBytes(32).toString("base64url");
  const id = createHash("sha256").update(token).digest("hex");

  await prisma.session.create({
    data: { id, userId: user.id, expiresAt: new Date(Date.now() + expiresInMs) },
  });

  return { token, id };
}

function send(handler, path, { method, session, body, headers = {} }) {
  setRequestCookies(session ? { session: session.token } : {});

  const init = { method, headers: { origin: ORIGIN, ...headers } };

  if (body !== undefined) {
    init.headers = { "content-type": "application/json", ...init.headers };
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  return handler(new Request(`${ORIGIN}${path}`, init));
}

const updateProfile = (options) => send(profileRoute.PATCH, "/api/account/profile", { method: "PATCH", ...options });
const changePasswordRequest = (options) =>
  send(passwordRoute.POST, "/api/account/password", { method: "POST", ...options });
const signOutOthers = (options) =>
  send(otherSessionsRoute.DELETE, "/api/account/other-sessions", { method: "DELETE", ...options });

const passwordBody = (overrides = {}) => ({
  currentPassword: PASSWORD,
  newPassword: NEW_PASSWORD,
  confirmNewPassword: NEW_PASSWORD,
  ...overrides,
});

async function sessionIds(user) {
  const sessions = await prisma.session.findMany({ where: { userId: user.id }, select: { id: true } });
  return sessions.map((session) => session.id).sort();
}

async function storedHash(user) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash;
}

test("every account endpoint requires a signed-in user", async () => {
  const user = await createAccount("anon");
  const expired = await signIn(user, { expiresInMs: -1000 });
  const hashBefore = await storedHash(user);

  for (const session of [undefined, expired, { token: "not-a-real-session" }]) {
    for (const response of [
      await updateProfile({ session, body: { name: "Intruder" } }),
      await changePasswordRequest({ session, body: passwordBody() }),
      await signOutOthers({ session }),
    ]) {
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, "UNAUTHORIZED");
    }
  }

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(row.name, user.name);
  assert.equal(row.passwordHash, hashBefore);
});

test("account changes from another origin or without JSON are refused", async () => {
  const user = await createAccount("origin");
  const session = await signIn(user);
  await signIn(user);
  const foreign = { origin: "https://evil.example" };

  for (const response of [
    await updateProfile({ session, body: { name: "Changed" }, headers: foreign }),
    await changePasswordRequest({ session, body: passwordBody(), headers: foreign }),
    await signOutOthers({ session, headers: foreign }),
  ]) {
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "FORBIDDEN");
  }

  for (const response of [
    await updateProfile({ session, body: { name: "Changed" }, headers: { "content-type": "text/plain" } }),
    await changePasswordRequest({ session, body: passwordBody(), headers: { "content-type": "text/plain" } }),
  ]) {
    assert.equal(response.status, 415);
  }

  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name, user.name);
  assert.equal((await sessionIds(user)).length, 2);
});

test("unverified users are sent to verify their email when verification is enforced", async () => {
  process.env.ENFORCE_EMAIL_VERIFICATION = "true";
  const user = await createAccount("unverified", { verified: false });
  const session = await signIn(user);

  for (const response of [
    await updateProfile({ session, body: { name: "Changed" } }),
    await changePasswordRequest({ session, body: passwordBody() }),
    await signOutOthers({ session }),
  ]) {
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "EMAIL_NOT_VERIFIED");
  }
});

test("the display name is trimmed, validated, and only changes for the signed-in user", async () => {
  const user = await createAccount("profile");
  const other = await createAccount("bystander");
  const session = await signIn(user);

  const response = await updateProfile({ session, body: { name: "  Grace Hopper  " } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: { name: "Grace Hopper" } });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name, "Grace Hopper");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).name, other.name);

  for (const body of [{ name: " A " }, { name: "x".repeat(101) }, {}, { name: "Valid", id: other.id }]) {
    const rejected = await updateProfile({ session, body });
    assert.equal(rejected.status, 400, `${JSON.stringify(body)} was accepted.`);
    assert.equal((await rejected.json()).error, "VALIDATION_ERROR");
  }

  const malformed = await updateProfile({ session, body: "{not json" });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "INVALID_JSON");

  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name, "Grace Hopper");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).name, other.name);
});

test("a wrong current password changes nothing", async () => {
  const user = await createAccount("wrong");
  const session = await signIn(user);
  await signIn(user);
  const hashBefore = await storedHash(user);
  const sessionsBefore = await sessionIds(user);

  const response = await changePasswordRequest({ session, body: passwordBody({ currentPassword: "Not-My-Password-1" }) });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.error, "INVALID_CURRENT_PASSWORD");
  assert.ok(data.fields.currentPassword);
  assert.equal(await storedHash(user), hashBefore);
  assert.deepEqual(await sessionIds(user), sessionsBefore);
});

test("a mismatched confirmation or unchanged password is rejected before checking", async () => {
  const user = await createAccount("confirm");
  const session = await signIn(user);
  const hashBefore = await storedHash(user);

  const mismatch = await changePasswordRequest({ session, body: passwordBody({ confirmNewPassword: "Something-Else-3" }) });
  assert.equal(mismatch.status, 400);
  assert.ok((await mismatch.json()).fields.confirmNewPassword);

  const unchanged = await changePasswordRequest({
    session,
    body: passwordBody({ newPassword: PASSWORD, confirmNewPassword: PASSWORD }),
  });
  assert.equal(unchanged.status, 400);
  assert.ok((await unchanged.json()).fields.newPassword);

  const short = await changePasswordRequest({ session, body: passwordBody({ newPassword: "short", confirmNewPassword: "short" }) });
  assert.equal(short.status, 400);
  assert.ok((await short.json()).fields.newPassword);

  assert.equal(await storedHash(user), hashBefore);
});

test("changing the password signs out other sessions but keeps this one", async () => {
  const user = await createAccount("change");
  const other = await createAccount("neighbor");
  const current = await signIn(user);
  await signIn(user);
  await signIn(user);
  const neighborSession = await signIn(other);
  const neighborHash = await storedHash(other);

  const { tokenHash } = generateHashedToken();
  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: "PASSWORD_RESET",
      tokenHash,
      email: `${uniqueName("reset")}@example.invalid`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const response = await changePasswordRequest({ session: current, body: passwordBody() });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { changed: true, signedOutSessions: 2 });

  const hash = await storedHash(user);
  assert.equal(await verifyPassword(NEW_PASSWORD, hash), true);
  assert.equal(await verifyPassword(PASSWORD, hash), false);
  assert.match(hash, /^\$2b\$12\$/);

  assert.deepEqual(await sessionIds(user), [current.id], "Only the session that made the change remains.");
  assert.equal(await prisma.authToken.count({ where: { userId: user.id, purpose: "PASSWORD_RESET" } }), 0);

  assert.deepEqual(await sessionIds(other), [neighborSession.id]);
  assert.equal(await storedHash(other), neighborHash);

  const stillSignedIn = await updateProfile({ session: current, body: { name: "Still Here" } });
  assert.equal(stillSignedIn.status, 200);
});

test("concurrent password changes with the same current password apply only once", async () => {
  const user = await createAccount("race");
  const session = await signIn(user);

  const results = await Promise.all([
    changePassword(user.id, session.id, { currentPassword: PASSWORD, newPassword: "First-Choice-1" }),
    changePassword(user.id, session.id, { currentPassword: PASSWORD, newPassword: "Second-Choice-2" }),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.deepEqual(results.find((result) => !result.ok), { ok: false, error: "INVALID_CURRENT_PASSWORD" });

  const winner = results[0].ok ? "First-Choice-1" : "Second-Choice-2";
  assert.equal(await verifyPassword(winner, await storedHash(user)), true);
  assert.deepEqual(await sessionIds(user), [session.id]);
});

test("repeated password guesses are rate limited per user", async () => {
  const user = await createAccount("guesses");
  const session = await signIn(user);
  const otherUser = await createAccount("unaffected");
  const otherSession = await signIn(otherUser);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await changePasswordRequest({ session, body: passwordBody({ currentPassword: `Guess-${attempt}-xyz` }) });
    assert.equal(response.status, 400, `Attempt ${attempt} was limited too early.`);
  }

  const limited = await changePasswordRequest({ session, body: passwordBody() });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  assert.equal(await verifyPassword(PASSWORD, await storedHash(user)), true, "Even the right password waits.");

  const unaffected = await changePasswordRequest({ session: otherSession, body: passwordBody({ currentPassword: "Wrong-Guess-9" }) });
  assert.equal(unaffected.status, 400, "Another user's attempts don't count against this one.");
});

test("signing out other sessions keeps this one, is repeatable, and leaves other users alone", async () => {
  const user = await createAccount("devices");
  const other = await createAccount("elsewhere");
  const current = await signIn(user);
  await signIn(user);
  await signIn(user);
  const otherSessions = [await signIn(other), await signIn(other)];

  const first = await signOutOthers({ session: current });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { signedOutSessions: 2 });
  assert.deepEqual(await sessionIds(user), [current.id]);

  const second = await signOutOthers({ session: current });
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { signedOutSessions: 0 });
  assert.deepEqual(await sessionIds(user), [current.id]);

  assert.deepEqual(await sessionIds(other), otherSessions.map((session) => session.id).sort());
});
