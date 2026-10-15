import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { after } from "next/server";

import { prisma } from "@/lib/prisma";

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number; retryAfterSeconds: 0 }
  | {
      allowed: false;
      remaining: 0;
      retryAfterSeconds: number;
      reason: "LIMITED" | "UNAVAILABLE";
    };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMITS = {
  verificationResendCooldown: {
    name: "verification-resend:cooldown",
    limit: 1,
    windowSeconds: MINUTE,
  },
  verificationResendDaily: {
    name: "verification-resend:daily",
    limit: 5,
    windowSeconds: DAY,
  },
  passwordResetByEmail: {
    name: "password-reset:email",
    limit: 3,
    windowSeconds: HOUR,
  },
  passwordResetByIp: {
    name: "password-reset:ip",
    limit: 10,
    windowSeconds: HOUR,
  },
  tokenConsumptionByIp: {
    name: "token-consumption:ip",
    limit: 20,
    windowSeconds: 15 * MINUTE,
  },
  signupByEmail: {
    name: "signup:email",
    limit: 5,
    windowSeconds: HOUR,
  },
  signupByIp: {
    name: "signup:ip",
    limit: 10,
    windowSeconds: HOUR,
  },
  loginByEmail: {
    name: "login:email",
    limit: 10,
    windowSeconds: 15 * MINUTE,
  },
  loginByIp: {
    name: "login:ip",
    limit: 30,
    windowSeconds: 15 * MINUTE,
  },
  // Keyed by account, so a stolen session can't be used to guess the current
  // password quickly.
  passwordChangeByUser: {
    name: "password-change:user",
    limit: 5,
    windowSeconds: 15 * MINUTE,
  },
} satisfies Record<string, RateLimitRule>;

const UNAVAILABLE_RETRY_AFTER_SECONDS = 60;
const MIN_SECRET_LENGTH = 32;
const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_BATCH_SIZE = 500;

const UNAVAILABLE: RateLimitResult = {
  allowed: false,
  remaining: 0,
  retryAfterSeconds: UNAVAILABLE_RETRY_AFTER_SECONDS,
  reason: "UNAVAILABLE",
};

// Identifiers are emails, user IDs, or IP addresses. A plain hash of an email
// can be reversed by hashing likely addresses, so keys are keyed with a secret
// the database never sees.
function hashKey(secret: string, rule: RateLimitRule, identifier: string) {
  return createHmac("sha256", secret)
    .update(`${rule.name}:${identifier}`)
    .digest("hex");
}

// Records one attempt and reports whether it fits within the rule's window.
//
// The single INSERT ... ON CONFLICT DO UPDATE statement is atomic: concurrent
// requests for the same key are serialized on the row, so each one sees a
// distinct count. Time comes from the database clock, so app servers with
// skewed clocks still agree on when a window ends.
//
// If the secret is missing or the database can't be reached, the attempt is
// denied rather than let through, so misconfiguration or an outage never
// disables the limit.
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const secret = process.env.RATE_LIMIT_SECRET;

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error(
      `Rate limiting is unavailable: RATE_LIMIT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters.`,
    );
    return UNAVAILABLE;
  }

  const key = hashKey(secret, rule, identifier);

  if (Math.random() < CLEANUP_PROBABILITY) {
    after(async () => {
      try {
        await deleteExpiredRateLimits();
      } catch (error) {
        console.error("Rate limit cleanup failed:", error);
      }
    });
  }

  try {
    const [row] = await prisma.$queryRaw<
      { count: number; retryAfterSeconds: number }[]
    >`
      INSERT INTO "rate_limits" AS rl ("key", "count", "resetAt")
      VALUES (
        ${key},
        1,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + make_interval(secs => ${rule.windowSeconds})
      )
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN rl."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1
          ELSE LEAST(rl."count" + 1, ${rule.limit + 1})
        END,
        "resetAt" = CASE
          WHEN rl."resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt"
          ELSE rl."resetAt"
        END
      RETURNING
        "count",
        GREATEST(
          CEIL(EXTRACT(EPOCH FROM ("resetAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))),
          1
        )::int AS "retryAfterSeconds"
    `;

    if (row.count <= rule.limit) {
      return {
        allowed: true,
        remaining: rule.limit - row.count,
        retryAfterSeconds: 0,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: row.retryAfterSeconds,
      reason: "LIMITED",
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return UNAVAILABLE;
  }
}

// Expired rows are harmless, because the next attempt starts a new window, but
// they accumulate. About one in a hundred rate-limit checks clears a batch
// after its response is sent, which keeps the table small without a scheduled
// job. The batch cap keeps each run short.
//
// Racing an upsert is safe. If the upsert renews a row first, Postgres
// rechecks the condition before deleting and skips it. If the delete wins,
// the upsert inserts a fresh row, which is what an expired row resets to.
export async function deleteExpiredRateLimits() {
  return prisma.$executeRaw`
    DELETE FROM "rate_limits"
    WHERE "key" IN (
      SELECT "key" FROM "rate_limits"
      WHERE "resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      LIMIT ${CLEANUP_BATCH_SIZE}
    )
    AND "resetAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  `;
}

// Only trusted on Vercel, which overwrites X-Forwarded-For with the real client
// address instead of passing on whatever the client sent. Anywhere else the
// header can be forged, so no IP is reported and callers must rely on limits
// keyed by email or user instead.
export function getTrustedClientIp(request: Request) {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return ip && isIP(ip) ? ip : null;
}
