import "server-only";

/**
 * Passkey enrollment and sign-in (issue #51) — the WebAuthn counterpart to
 * `src/lib/auth.ts`'s email+password `signIn`/`signOut`. Every function here
 * follows that file's own pattern exactly: call `auth.api.*` directly
 * (`src/lib/betterAuth.ts`'s `getAuth()`), never through a mounted
 * `/api/auth/*` route (there isn't one), and replay any `Set-Cookie` header
 * onto Next's own `cookies()` store by hand via `applySetCookieHeader`.
 *
 * The passkey plugin (`@better-auth/passkey`) exposes its endpoints as plain
 * `auth.api.*` methods — `generatePasskeyRegistrationOptions`,
 * `verifyPasskeyRegistration`, `generatePasskeyAuthenticationOptions`,
 * `verifyPasskeyAuthentication`, `listPasskeys`, `deletePasskey` — exactly
 * like `signInEmail`/`getSession`/`signOut` already are, so no new plumbing
 * was needed to reach them: they were never HTTP-only in the first place.
 * The two "generate options" endpoints set a short-lived signed cookie
 * holding the WebAuthn challenge; that cookie only has to survive the trip
 * from one server action call to the next (the enrollment or sign-in
 * ceremony that runs in the browser in between), so it round-trips through
 * the browser the same way the session cookie itself does.
 *
 * **Enrollment** (`startPasskeyEnrollment`/`finishPasskeyEnrollment`) needs
 * no guard of its own: `generatePasskeyRegistrationOptions` and
 * `verifyPasskeyRegistration` both require a session by default
 * (`requireSession: true`, left at its default in `betterAuth.ts`), so
 * Better Auth itself refuses either call with no signed-in owner behind it
 * — issue #51's rule 2. The session's own `freshAge` (Better Auth's default
 * is 24h) never gets in the way of that either, since this app's own
 * sessions expire at 12h (`SESSION_MAX_AGE_SECONDS`) — a session that still
 * exists at all is always "fresh" by that measure.
 *
 * **Sign-in** (`startPasskeySignIn`/`finishPasskeySignIn`) needs its own
 * throttle, since Better Auth's passkey plugin has none and this app's own
 * rate limiting (`src/lib/signInThrottle.ts`) is keyed by email — something
 * a WebAuthn assertion doesn't carry. `finishPasskeySignIn` looks up which
 * owner (if any) the presented credential ID belongs to *before* asking
 * Better Auth to verify it, purely so a failed attempt can be charged
 * against that owner's email channel too, exactly like a wrong password is
 * — an unrecognized credential ID (the common case for an attacker with no
 * real passkey at all) falls back to a per-IP synthetic key instead, so it
 * still costs the IP channel without ever writing to a real owner's row.
 * Either way the lockout and the generic error are shared with password
 * sign-in via the very same `sign_in_attempts` table and `"sign_in"` kind.
 */
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getAuthenticatorName } from "@better-auth/passkey";
import { getDb } from "@/db/client";
import { passkey as passkeyTable, user } from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { redactEmail } from "@/lib/logRedaction";
import {
  applySetCookieHeader,
  GENERIC_SIGN_IN_ERROR,
  markSignedInBefore,
  resolveClientIp,
} from "@/lib/auth";
import {
  checkThrottle,
  clearFailedAttempts,
  pruneSignInAttempts,
  recordSignInAttempt,
} from "@/lib/signInThrottle";

/** A registered passkey, shaped for display — never the raw Better Auth
 * `Passkey` row (which also carries `publicKey`, `counter`, `userId`, none
 * of which the Settings card has any use for). */
export type OwnerPasskey = {
  id: string;
  /** Owner-supplied label, or a best-effort authenticator name
   * (`getAuthenticatorName`), or plain "Passkey" if neither is available. */
  name: string;
  /** ISO timestamp. */
  createdAt: string;
};

function displayName(name: string | null | undefined, aaguid: string | null | undefined): string {
  return name?.trim() || getAuthenticatorName(aaguid) || "Passkey";
}

/** Every passkey on the signed-in owner's account, newest first. Empty
 * (rather than throwing) if there's no session — callers that need to
 * enforce a session do so themselves (`requireOwner()`, same as every other
 * Settings action). */
export async function listOwnerPasskeys(): Promise<OwnerPasskey[]> {
  const auth = await getAuth();
  const headerList = await headers();
  try {
    const rows = await auth.api.listPasskeys({ headers: headerList });
    return [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => ({
        id: row.id,
        name: displayName(row.name, row.aaguid),
        createdAt: row.createdAt.toISOString(),
      }));
  } catch {
    return [];
  }
}

/**
 * The same list as `listOwnerPasskeys`, but for a caller that has already
 * resolved the owner — `/admin/settings`'s own server component, which
 * calls `requireOwner()` before anything else.
 *
 * This exists because `auth.api.listPasskeys` runs `sessionMiddleware`,
 * which re-reads the session row and its user before it gets anywhere near
 * the passkeys — three serialized round trips where the page already knows
 * who is asking. That page re-renders on every `router.refresh()` the
 * Owners card fires, and issue #38 is precisely about how long those
 * re-renders take on a database that runs one query at a time; adding two
 * redundant lookups to it is not free. One join instead.
 */
export async function listPasskeysForEmail(email: string): Promise<OwnerPasskey[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: passkeyTable.id,
      name: passkeyTable.name,
      aaguid: passkeyTable.aaguid,
      createdAt: passkeyTable.createdAt,
    })
    .from(passkeyTable)
    .innerJoin(user, eq(passkeyTable.userId, user.id))
    .where(eq(user.email, email))
    .orderBy(desc(passkeyTable.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: displayName(row.name, row.aaguid),
    createdAt: row.createdAt.toISOString(),
  }));
}

export type StartEnrollmentResult =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; error: string };

/** Step 1 of enrolling a new passkey: asks Better Auth for a fresh
 * registration challenge (and, via its `Set-Cookie`, stashes it for step 2
 * to read back). `name`, if given, only ever seeds the authenticator's own
 * on-device label — the name actually stored is whatever
 * `finishPasskeyEnrollment` is called with. */
export async function startPasskeyEnrollment(name?: string): Promise<StartEnrollmentResult> {
  const auth = await getAuth();
  const headerList = await headers();
  try {
    const { headers: outHeaders, response } = await auth.api.generatePasskeyRegistrationOptions({
      headers: headerList,
      query: name ? { name } : undefined,
      returnHeaders: true,
    });
    await applySetCookieHeader(outHeaders.get("set-cookie"));
    return { ok: true, options: response };
  } catch {
    return { ok: false, error: "Couldn't start passkey setup. Try again." };
  }
}

export type FinishEnrollmentResult =
  | { ok: true; passkey: OwnerPasskey }
  | { ok: false; error: string };

/** Step 2: verifies the browser's WebAuthn registration response against
 * the challenge step 1 stashed, and stores the new credential under `name`
 * (trimmed; falls back to the authenticator's own metadata if left blank).
 * Never creates a session — the owner enrolling is already signed in. */
export async function finishPasskeyEnrollment(
  response: RegistrationResponseJSON,
  name?: string,
): Promise<FinishEnrollmentResult> {
  const auth = await getAuth();
  const headerList = await headers();
  try {
    const { response: result } = await auth.api.verifyPasskeyRegistration({
      headers: headerList,
      body: {
        response,
        name: name?.trim() || undefined,
        createSession: false,
      },
      returnHeaders: true,
    });
    return {
      ok: true,
      passkey: {
        id: result.id,
        name: displayName(result.name, result.aaguid),
        createdAt: result.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Couldn't add that passkey. Try again." };
  }
}

/** Removes one of the signed-in owner's passkeys. Removing the last one is
 * always allowed — the password still works, per issue #51's rule 3.
 * Better Auth's own `deletePasskey` endpoint already refuses to delete a
 * passkey that belongs to someone else (`requireResourceOwnership`), so
 * there's nothing extra to check here. */
export async function removeOwnerPasskey(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAuth();
  const headerList = await headers();
  try {
    await auth.api.deletePasskey({ headers: headerList, body: { id } });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that passkey." };
  }
}

export type StartPasskeySignInResult =
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { ok: false; error: string };

/** Step 1 of a passkey sign-in: no email, no session, nothing to throttle
 * yet — just a fresh authentication challenge. `AUTH_SECRET` unset means
 * sign-in isn't configured at all yet, same guard `signIn` (`@/lib/auth`)
 * itself opens with. */
export async function startPasskeySignIn(): Promise<StartPasskeySignInResult> {
  if (!process.env.AUTH_SECRET) return { ok: false, error: GENERIC_SIGN_IN_ERROR };

  const auth = await getAuth();
  const headerList = await headers();
  try {
    const { headers: outHeaders, response } = await auth.api.generatePasskeyAuthenticationOptions({
      headers: headerList,
      returnHeaders: true,
    });
    await applySetCookieHeader(outHeaders.get("set-cookie"));
    return { ok: true, options: response };
  } catch {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }
}

export type FinishPasskeySignInResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

/** Step 2: verifies the browser's WebAuthn assertion and, on success, sets
 * the session cookie — see this module's doc comment for the throttle
 * shape. `ipOverride` exists only for tests, same as `signIn`'s. */
export async function finishPasskeySignIn(
  response: AuthenticationResponseJSON,
  ipOverride?: string,
): Promise<FinishPasskeySignInResult> {
  if (!process.env.AUTH_SECRET) return { ok: false, error: GENERIC_SIGN_IN_ERROR };

  const db = await getDb();
  const ip = await resolveClientIp(ipOverride);
  const now = new Date();
  await pruneSignInAttempts(db, now);

  const credentialId = typeof response?.id === "string" ? response.id : "";
  let matchedEmail: string | null = null;
  if (credentialId) {
    const [row] = await db
      .select({ email: user.email })
      .from(passkeyTable)
      .innerJoin(user, eq(passkeyTable.userId, user.id))
      .where(eq(passkeyTable.credentialID, credentialId));
    matchedEmail = row?.email ?? null;
  }
  // Charges an unrecognized credential's failures to a per-IP synthetic
  // key rather than a shared literal, so a flood of garbage assertions from
  // many different IPs can never look like one channel closing in on a
  // lockout together.
  const throttleEmail = matchedEmail ?? `passkey-unknown:${ip}`;

  const throttle = await checkThrottle(db, throttleEmail, ip, now);
  if (throttle.locked) {
    console.warn("[auth] passkey sign-in throttled", {
      email: redactEmail(throttleEmail),
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

  const auth = await getAuth();
  const headerList = await headers();
  let verified: { email: string; setCookieHeader: string | null } | null = null;
  try {
    const { headers: outHeaders, response: result } = await auth.api.verifyPasskeyAuthentication({
      headers: headerList,
      body: { response },
      returnHeaders: true,
    });
    verified = { email: result.user.email, setCookieHeader: outHeaders.get("set-cookie") };
  } catch {
    verified = null;
  }

  if (!verified) {
    await recordSignInAttempt(db, throttleEmail, ip, false, now);
    console.warn("[auth] failed passkey sign-in attempt", {
      email: redactEmail(throttleEmail),
      ip,
    });
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }

  await applySetCookieHeader(verified.setCookieHeader);
  await markSignedInBefore();
  await recordSignInAttempt(db, verified.email, ip, true, now);
  await clearFailedAttempts(db, verified.email);

  return { ok: true };
}
