import "server-only";

/**
 * Owner sign-in — email allowlist + a shared password, hashed and stored
 * only as `OWNER_PASSWORD_HASH`. No third-party auth service: the whole
 * credential story is `src/lib/password.ts` (scrypt) and
 * `src/lib/sessionToken.ts` (HS256 JWT via `jose`), both plain enough to
 * swap for magic-link email later without touching callers of this module.
 *
 * The `owners` table (`src/db/schema.ts`) is an optional allowlist upgrade:
 * once it has rows, those rows are the allowlist instead of `OWNER_EMAILS`,
 * and a first successful sign-in seeds it from `OWNER_EMAILS` when it is
 * still empty.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { owners } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { parseOwnerEmails } from "@/lib/ownerAllowlist";
import { checkThrottle, pruneSignInAttempts, recordSignInAttempt } from "@/lib/signInThrottle";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type OwnerSession,
} from "@/lib/sessionToken";

export type { OwnerSession };

const GENERIC_SIGN_IN_ERROR = "That email or password isn't right.";

function ownerEmailsFromEnv(): string[] {
  return parseOwnerEmails(process.env.OWNER_EMAILS);
}

/** First IP in `x-forwarded-for` (the client, per convention — proxies
 * append their own), falling back to `x-real-ip`. Vercel sets both. */
function firstForwardedIp(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

/** The caller's IP for the throttle: `ipOverride` lets tests pass one
 * directly instead of going through `headers()` (there is no request to
 * read headers from in a unit test). Falls back to `"unknown"` — a single
 * shared bucket — if neither header is present, which only ever happens
 * off Vercel. */
async function resolveClientIp(ipOverride?: string): Promise<string> {
  if (ipOverride) return ipOverride;
  const headerList = await headers();
  return (
    firstForwardedIp(headerList.get("x-forwarded-for")) ??
    headerList.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

/** True once AUTH_SECRET, OWNER_EMAILS and OWNER_PASSWORD_HASH are all set. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET && process.env.OWNER_EMAILS && process.env.OWNER_PASSWORD_HASH,
  );
}

/** Reads and verifies the `cne_owner` cookie. Null when missing/invalid/expired. */
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token, secret);
}

/**
 * Like `getOwnerSession`, but redirects to sign-in (carrying `next` back to
 * the page that was requested) instead of returning null. `next` comes from
 * the `x-pathname` header `src/middleware.ts` sets on every `/admin`
 * request; falls back to `/admin` if that header is absent.
 */
export async function requireOwner(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (session) return session;

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "/admin";
  redirect(`/admin/sign-in?next=${encodeURIComponent(pathname)}`);
}

/**
 * Verifies email + password and, on success, sets the session cookie.
 * Every failure path — unknown email, wrong password, auth not configured —
 * runs the same scrypt derivation and returns the same generic error, so
 * neither timing nor message tells an attacker which part was wrong.
 *
 * Throttled first: 5 failed attempts for either the email or the IP in the
 * last 15 minutes refuses the request with the same generic error — and,
 * unlike the paths below, *without* spending a scrypt call, since the answer
 * doesn't depend on the password at all once a channel is locked — plus a
 * `retryAfterSeconds` hint. `ipOverride` exists only so tests can supply an
 * IP directly; real callers always let it come from `headers()`.
 */
export async function signIn(
  email: string,
  password: string,
  ipOverride?: string,
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  const secret = process.env.AUTH_SECRET;
  const passwordHash = process.env.OWNER_PASSWORD_HASH;
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAuthConfigured() || !secret || !passwordHash) {
    // Still spend the scrypt call so this path costs the same as a real
    // wrong-password check.
    await verifyPassword(password, "scrypt$00$00");
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  const db = await getDb();
  const ip = await resolveClientIp(ipOverride);
  const now = new Date();

  await pruneSignInAttempts(db, now);

  const throttle = await checkThrottle(db, normalizedEmail, ip, now);
  if (throttle.locked) {
    await recordSignInAttempt(db, normalizedEmail, ip, false, now);
    console.warn("[auth] sign-in throttled", {
      email: normalizedEmail,
      ip,
      emailFailures: throttle.emailFailures,
      ipFailures: throttle.ipFailures,
    });
    return {
      ok: false,
      error: GENERIC_SIGN_IN_ERROR,
      retryAfterSeconds: throttle.retryAfterSeconds,
    };
  }

  const existingOwners = await db.select({ email: owners.email, name: owners.name }).from(owners);
  const allowlist =
    existingOwners.length > 0
      ? existingOwners.map((owner) => owner.email.toLowerCase())
      : ownerEmailsFromEnv();
  const allowed = allowlist.includes(normalizedEmail);

  const passwordOk = await verifyPassword(password, passwordHash);

  if (!allowed || !passwordOk) {
    await recordSignInAttempt(db, normalizedEmail, ip, false, now);
    console.warn("[auth] failed sign-in attempt", {
      email: normalizedEmail,
      ip,
      count: throttle.emailFailures + 1,
    });
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  if (existingOwners.length === 0) {
    const seedEmails = ownerEmailsFromEnv();
    if (seedEmails.length > 0) {
      await db
        .insert(owners)
        .values(seedEmails.map((seedEmail) => ({ email: seedEmail })))
        .onConflictDoNothing();
    }
  }

  const matched = existingOwners.find((owner) => owner.email.toLowerCase() === normalizedEmail);
  const token = await signSessionToken(
    { email: normalizedEmail, name: matched?.name ?? null },
    secret,
  );

  await recordSignInAttempt(db, normalizedEmail, ip, true, now);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

/** Clears the owner-session cookie. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
