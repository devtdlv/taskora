import "server-only";

import bcrypt from "bcrypt";

import {
  MAX_PASSWORD_BYTES,
  passwordByteLength,
} from "@/lib/validations/auth";

const BCRYPT_COST = 12;

// A hash of a random value nobody knows, at the same cost as real hashes. It
// never matches, it only spends the same work as a real comparison.
const DUMMY_PASSWORD_HASH =
  "$2b$12$W3.p0pLqGu6lc3oYlilZaum8SNAcUG0Ph8YyF1mZ6V20T26Riu/na";

export async function hashPassword(password: string) {
  // Validation already rejects these. This stops any path that skips it from
  // storing a hash that silently ignores the end of the password.
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    throw new Error("PASSWORD_TOO_LONG");
  }

  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

// Used when there's no account, so a login for an unknown email does the same
// bcrypt work as a wrong password for a real one.
export async function verifyAgainstDummyHash(password: string) {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}
