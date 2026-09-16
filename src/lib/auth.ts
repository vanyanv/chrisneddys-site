import "server-only";

/**
 * Owner sign-in — Better Auth (`src/lib/betterAuth.ts`), fronted by this
 * module so every caller keeps calling `signIn` / `signOut` /
 * `getOwnerSession` / `requireOwner` exactly as before. See
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 *
 * Three things this module does that Better Auth doesn't do on its own:
 *
 * - **Throttle.** `src/lib/signInThrottle.ts` wraps every `signIn` call,
 *   unchanged from the shared-password era — Better Auth's own rate
 *   limiting stays off.
 * - **Bootstrap.** The very first sign-in, while the `user` table is still
 *   empty, seeds one account from `OWNER_EMAILS` + `OWNER_PASSWORD_HASH` —
 *   see `bootstrapFirstOwnerIfNeeded` below and DEPLOY.md's "Owner
 *   accounts" section. Once any `user` row exists, both env vars are
 *   ignored entirely.
 * - **Legacy rehash.** A sign-in that verifies against a pre-migration
 *   3-field scrypt hash (`src/lib/password.ts`) is rehashed to the current
 *   format immediately after — see `rehashLegacyPasswordIfNeeded`.
 *
 * Cookies: no `/api/auth/*` route is mounted (see `src/lib/betterAuth.ts`),
 * so every `auth.api.*` call here that sets or clears a cookie is made with
 * `returnHeaders: true` and the resulting `Set-Cookie` header is replayed
 * onto Next's own `cookies()` store by hand (`applySetCookieHeader`) rather
 * than Better Auth writing it directly.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { getDb, type Db } from "@/db/client";
import { SIGNED_IN_BEFORE_COOKIE, SIGNED_IN_BEFORE_MAX_AGE } from "@/lib/adminCookies";
import { account, user } from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { hashPassword, verifyPassword, verifyPasswordDetailed } from "@/lib/password";
import { parseOwnerEmails } from "@/lib/ownerAllowlist";
import {
  checkThrottle,
  clearFailedAttempts,
  pruneSignInAttempts,
  recordSignInAttempt,
  remainingSignInAttempts,
} from "@/lib/signInThrottle";

/** An owner's session, as read back from Better Auth's `session` + `user`
 * rows. `issuedAt` is the session row's `createdAt`, in Unix seconds. */
export type OwnerSession = { email: string; name: string | null; issuedAt: number };

/** Exported so `src/lib/passkeys.ts` can return the exact same wording on
 * every failure path a passkey sign-in can take too — a wrong password and
 * an unrecognized (or rejected) passkey must read identically, so neither
 * ever tells an attacker which one was tried. */
export const GENERIC_SIGN_IN_ERROR = "That email or password isn't right.";

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
 * off Vercel. Exported so other throttled server actions (e.g. the order
 * lookup form, `src/app/(site)/shop/order/actions.ts`) read the client IP
 * the same way `signIn` does. */
export async function resolveClientIp(ipOverride?: string): Promise<string> {
  if (ipOverride) return ipOverride;
  const headerList = await headers();
  return (
    firstForwardedIp(headerList.get("x-forwarded-for")) ??
    headerList.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

/** True once AUTH_SECRET, OWNER_EMAILS and OWNER_PASSWORD_HASH are all set.
 * Used by the setup checklist and the sign-in page's "not configured yet"
 * notice — unrelated to whether sign-in actually works once owner accounts
 * exist (at that point only `AUTH_SECRET` still matters). */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET && process.env.OWNER_EMAILS && process.env.OWNER_PASSWORD_HASH,
  );
}

/** Replays a `Set-Cookie` header Better Auth produced (from an
 * `auth.api.*` call made with `returnHeaders: true`) onto Next's own
 * `cookies()` store, so the browser gets the exact cookie(s) Better Auth
 * intended — name, value and every attribute — without this module having
 * to know its cookie name or shape. A no-op when there's nothing to set. */
export async function applySetCookieHeader(setCookieHeader: string | null): Promise<void> {
  if (!setCookieHeader) return;
  const store = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(setCookieHeader)) {
    store.set(name, attributes.value, toCookieOptions(attributes));
  }
}

/**
 * Records that this browser has signed in at least once, so a later
 * cookieless visit to a protected path can tell an expired session apart
 * from a first-ever visit and the sign-in page only claims "you were signed
 * out" when that actually happened. Scoped to `/admin` and `httpOnly` —
 * nothing outside the admin, and no client script, has any use for it.
 * Exported so `src/lib/passkeys.ts`'s passkey sign-in marks the same cookie
 * a password sign-in does.
 */
export async function markSignedInBefore(): Promise<void> {
  const store = await cookies();
  store.set(SIGNED_IN_BEFORE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SIGNED_IN_BEFORE_MAX_AGE,
  });
}

/**
 * First sign-in, empty `user` table: if `email` is allowlisted in
 * `OWNER_EMAILS` and `password` verifies against `OWNER_PASSWORD_HASH`,
 * creates that owner's account with that same password so the
 * `auth.api.signInEmail` call right after this one succeeds. A no-op the
 * moment any `user` row exists — both env vars are then ignored forever,
 * per DEPLOY.md's "Owner accounts" section.
 */
async function bootstrapFirstOwnerIfNeeded(
  db: Db,
  normalizedEmail: string,
  password: string,
): Promise<void> {
  const [existing] = await db.select({ id: user.id }).from(user).limit(1);
  if (existing) return;

  const passwordHash = process.env.OWNER_PASSWORD_HASH;
  if (!passwordHash) return;
  if (!ownerEmailsFromEnv().includes(normalizedEmail)) return;
  if (!(await verifyPassword(password, passwordHash))) return;

  const auth = await getAuth();
  const name = normalizedEmail.split("@")[0] || normalizedEmail;
  try {
    await auth.api.signUpEmail({ body: { name, email: normalizedEmail, password } });
  } catch (err) {
    // Best-effort: if a concurrent sign-in already created this account
    // between the empty-table check above and this call, the sign-in that
    // follows still succeeds against the row that won the race.
    console.warn("[auth] bootstrap account creation failed", err);
  }
}

/**
 * Rehashes `userId`'s stored credential password if (and only if) it just
 * verified against a legacy (pre-migration) hash. Called after the session
 * cookie is already applied, and its own errors are swallowed by the
 * caller, so a slow or failing rehash can never turn a successful sign-in
 * into a failure.
 */
async function rehashLegacyPasswordIfNeeded(
  db: Db,
  userId: string,
  password: string,
): Promise<void> {
  const [credentialAccount] = await db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!credentialAccount?.password) return;

  const { generation } = await verifyPasswordDetailed(password, credentialAccount.password);
  if (generation !== "legacy") return;

  const rehashed = await hashPassword(password);
  await db
    .update(account)
    .set({ password: rehashed, updatedAt: new Date() })
    .where(eq(account.id, credentialAccount.id));
}

/** Reads the current owner session via Better Auth, from the incoming
 * request's cookies. Null when there is none, it's expired, or
 * `AUTH_SECRET` isn't set. */
export async function getOwnerSession(): Promise<OwnerSession | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const auth = await getAuth();
  const headerList = await headers();
  const result = await auth.api.getSession({ headers: headerList });
  if (!result) return null;

  return {
    email: result.user.email,
    name: result.user.name ?? null,
    issuedAt: Math.floor(result.session.createdAt.getTime() / 1000),
  };
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
  // `expired=1` here for the same reason `src/middleware.ts` sets it on its
  // own sign-in redirect: reaching this branch means a cookie was present
  // (middleware let the request through) but Better Auth's own session
  // lookup came back empty — a session that expired or was revoked after
  // the request left the browser, not a fresh visitor. Same explanation,
  // same query param.
  redirect(`/admin/sign-in?next=${encodeURIComponent(pathname)}&expired=1`);
}

/**
 * Verifies email + password through Better Auth and, on success, sets the
 * session cookie. Every failure path — unknown email, wrong password, no
 * `AUTH_SECRET` configured — returns the same generic error, so the message
 * never tells an attacker which part was wrong.
 *
 * Throttled first: 5 failed attempts for either the email or the IP in the
 * last 15 minutes refuses the request with the same generic error — and,
 * unlike the path below, *without* even asking Better Auth to check the
 * password, since the answer doesn't depend on it at all once a channel is
 * locked — plus a `retryAfterSeconds` hint. That refusal is not itself
 * recorded as an attempt: it never reached a password comparison, so
 * recording it would just be the lockout re-arming its own 15-minute window
 * on every retry, locking out the owner forever. `ipOverride` exists only so
 * tests can supply an IP directly; real callers always let it come from
 * `headers()`.
 */
export async function signIn(
  email: string,
  password: string,
  ipOverride?: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number; remainingAttempts?: number }
> {
  const secret = process.env.AUTH_SECRET;
  const normalizedEmail = email.trim().toLowerCase();

  if (!secret) {
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

  await bootstrapFirstOwnerIfNeeded(db, normalizedEmail, password);

  const auth = await getAuth();
  let signedIn: { userId: string; setCookieHeader: string | null } | null = null;
  try {
    const { headers: outHeaders, response } = await auth.api.signInEmail({
      body: { email: normalizedEmail, password },
      returnHeaders: true,
    });
    signedIn = { userId: response.user.id, setCookieHeader: outHeaders.get("set-cookie") };
  } catch {
    signedIn = null;
  }

  if (!signedIn) {
    await recordSignInAttempt(db, normalizedEmail, ip, false, now);
    const failuresNow = throttle.emailFailures + 1;
    console.warn("[auth] failed sign-in attempt", {
      email: normalizedEmail,
      ip,
      count: failuresNow,
    });
    return {
      ok: false,
      error: GENERIC_SIGN_IN_ERROR,
      // `checkThrottle` locks on *either* channel hitting the limit, so the
      // honest countdown is the worse of the two. Counting only this email's
      // failures would promise "4 tries left" to someone whose IP is one
      // attempt from a lockout — a number that is wrong in exactly the moment
      // it matters. In the ordinary case (an owner on their own connection)
      // the two channels move together and this reads the same either way.
      remainingAttempts: remainingSignInAttempts(Math.max(failuresNow, throttle.ipFailures + 1)),
    };
  }

  await applySetCookieHeader(signedIn.setCookieHeader);
  await markSignedInBefore();
  await recordSignInAttempt(db, normalizedEmail, ip, true, now);
  await clearFailedAttempts(db, normalizedEmail);

  // The session is issued — a rehash failing or running slowly from here on
  // must not turn this into a failed sign-in.
  try {
    await rehashLegacyPasswordIfNeeded(db, signedIn.userId, password);
  } catch (err) {
    console.error("[auth] failed to rehash legacy password", err);
  }

  return { ok: true };
}

/** Signs out the current owner: revokes the session server-side (rather
 * than only clearing a cookie) and clears the cookie in the browser. */
export async function signOut(): Promise<void> {
  const auth = await getAuth();
  const headerList = await headers();
  try {
    const { headers: outHeaders } = await auth.api.signOut({
      headers: headerList,
      returnHeaders: true,
    });
    await applySetCookieHeader(outHeaders.get("set-cookie"));
  } catch (err) {
    console.error("[auth] sign-out failed", err);
  }
}
