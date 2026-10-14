// The database tests create and delete real rows, so they only run against a
// database that is clearly meant for them: TEST_DATABASE_URL, from the
// environment or .env, must name a database ending in "_test", and it must not
// be the database in DATABASE_URL or DIRECT_URL from either place.

import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const ENV_FILE = new URL("../../.env", import.meta.url);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function databaseIdentity(value) {
  const url = new URL(value);
  const host = LOCAL_HOSTS.has(url.hostname) ? "localhost" : url.hostname.toLowerCase();

  return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function getTestDatabaseUrl() {
  const fromFile = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : {};
  const value = process.env.TEST_DATABASE_URL || fromFile.TEST_DATABASE_URL;
  const others = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    fromFile.DATABASE_URL,
    fromFile.DIRECT_URL,
  ].filter(Boolean);

  if (!value) {
    throw new Error("TEST_DATABASE_URL is not set. The database tests need their own database.");
  }

  const identity = databaseIdentity(value);

  if (!/_test$/.test(identity)) {
    throw new Error("TEST_DATABASE_URL must name a database ending in _test.");
  }

  if (others.some((other) => databaseIdentity(other) === identity)) {
    throw new Error("TEST_DATABASE_URL points at the app's database. Use a separate test database.");
  }

  return value;
}
