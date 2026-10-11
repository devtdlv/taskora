import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

// 32 random bytes is 256 bits of entropy, so a fast hash is enough: the token
// can't be brute-forced, and the database only ever sees the hash.
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateHashedToken() {
  const token = generateToken();

  return { token, tokenHash: hashToken(token) };
}
