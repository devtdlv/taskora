// Brings the test database up to date and empties it before the database
// tests run. Every command gets the test URL as both DATABASE_URL and
// DIRECT_URL, which take precedence over .env, so nothing here can reach the
// app's database.

import { spawnSync } from "node:child_process";

import { getTestDatabaseUrl } from "./test-database.mjs";

const url = getTestDatabaseUrl();
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };

function prisma(args, input) {
  const result = spawnSync(`npx prisma ${args}`, {
    env,
    input,
    shell: true,
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

prisma("migrate deploy");

// Cascades to every table that references these.
prisma(
  "db execute --stdin --schema prisma/schema.prisma",
  'TRUNCATE TABLE "users", "workspaces", "rate_limits" CASCADE;',
);
