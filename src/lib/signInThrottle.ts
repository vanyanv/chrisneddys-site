/**
 * Sign-in throttle: reads and writes `sign_in_attempts` and decides whether
 * an email or an IP is currently locked out. Pulled out of `src/lib/auth.ts`
 * (which is `server-only`) so it can be unit tested against a plain PGlite
 * instance — same reasoning as `src/lib/password.ts`, `src/lib/
 * sessionToken.ts` and `src/lib/ownerAllowlist.ts`.
 */
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { signInAttempts } from "@/db/schema";

/** A channel (email or IP) is locked once it has this many failed attempts
 * inside `LOCKOUT_WINDOW_MS`. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
/** How long `sign_in_attempts` rows are kept before `pruneSignInAttempts`
 * deletes them — well past the lockout window, just enough to be useful in
 * logs/debugging without growing forever. */
export const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

type FailureStats = { count: number; oldestAttemptedAt: Date | null };

/** Count of failed attempts matching `matchColumn` in the last
 * `LOCKOUT_WINDOW_MS`, plus the earliest of them (used to compute
 * `retryAfterSeconds`). */
async function recentFailureStats(db: Db, matchColumn: SQL, now: Date): Promise<FailureStats> {
  const since = new Date(now.getTime() - LOCKOUT_WINDOW_MS);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldestAttemptedAt: sql<string | null>`min(${signInAttempts.attemptedAt})`,
    })
    .from(signInAttempts)
    .where(
      and(matchColumn, eq(signInAttempts.succeeded, false), gte(signInAttempts.attemptedAt, since)),
    );
  return {
    count: row?.count ?? 0,
    oldestAttemptedAt: row?.oldestAttemptedAt ? new Date(row.oldestAttemptedAt) : null,
  };
}

/** Seconds until `stats`' channel falls back under the limit — 0 if it isn't
 * currently locked. */
function retryAfterSecondsFrom(stats: FailureStats, now: Date): number {
  if (stats.count < MAX_FAILED_ATTEMPTS || !stats.oldestAttemptedAt) return 0;
  const retryAfterMs = stats.oldestAttemptedAt.getTime() + LOCKOUT_WINDOW_MS - now.getTime();
  return Math.max(0, Math.ceil(retryAfterMs / 1000));
}

export type ThrottleStatus = {
  locked: boolean;
  /** 0 when not locked. */
  retryAfterSeconds: number;
  emailFailures: number;
  ipFailures: number;
};

/**
 * Whether `email` or `ip` currently has 5+ failed attempts in the last 15
 * minutes. Counts only failures — a success never needs to "clear" a count,
 * since successes simply aren't counted.
 */
export async function checkThrottle(
  db: Db,
  email: string,
  ip: string,
  now: Date = new Date(),
): Promise<ThrottleStatus> {
  const [emailStats, ipStats] = await Promise.all([
    recentFailureStats(db, eq(signInAttempts.email, email), now),
    recentFailureStats(db, eq(signInAttempts.ip, ip), now),
  ]);
  return {
    locked: emailStats.count >= MAX_FAILED_ATTEMPTS || ipStats.count >= MAX_FAILED_ATTEMPTS,
    retryAfterSeconds: Math.max(
      retryAfterSecondsFrom(emailStats, now),
      retryAfterSecondsFrom(ipStats, now),
    ),
    emailFailures: emailStats.count,
    ipFailures: ipStats.count,
  };
}

/** Records one sign-in attempt (success or failure) for `email` + `ip`.
 * `now` is written explicitly (rather than left to the column's
 * `defaultNow()`) so it lines up with whatever clock `checkThrottle` used —
 * the same `now` a caller like `signIn` computes once and reuses for both. */
export async function recordSignInAttempt(
  db: Db,
  email: string,
  ip: string,
  succeeded: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db.insert(signInAttempts).values({ email, ip, succeeded, attemptedAt: now });
}

/** Deletes `sign_in_attempts` rows older than 24h. Meant to be called
 * opportunistically (e.g. once per `signIn` call) rather than on a schedule —
 * cheap and idempotent, and keeps the table from growing forever without a
 * cron job. */
export async function pruneSignInAttempts(db: Db, now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - ATTEMPT_RETENTION_MS);
  await db.delete(signInAttempts).where(lt(signInAttempts.attemptedAt, cutoff));
}
