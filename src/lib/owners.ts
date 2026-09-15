import "server-only";

/**
 * The admin data/logic layer behind the Owners card on `/admin/settings` —
 * see `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 *
 * Deliberately does **not** call `requireOwner()` itself: unlike
 * `src/lib/settingsAdmin.ts`, every function here takes the acting owner's
 * email as a plain argument instead of reading a session, which is what
 * keeps this unit-testable against PGlite directly (`owners.test.ts`) —
 * `src/lib/ordersAdmin.ts`'s own module comment notes that a `requireOwner()`
 * call makes a function "hard to unit test outside a real request", since it
 * needs `cookies()`/`headers()` context Vitest never has. Every caller in
 * `src/app/(admin)/admin/settings/actions.ts` calls `requireOwner()` first
 * and passes its `email` down.
 *
 * Removing an owner deletes their `user` row only — their `session` and
 * `account` rows go with it via the `ON DELETE CASCADE` on both tables'
 * `user_id` foreign key (migration `0006`), proven in `owners.test.ts`
 * rather than assumed.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { user } from "@/db/schema";
import { captureResetSend, getAuth } from "@/lib/betterAuth";

export type OwnerRow = {
  email: string;
  name: string;
  createdAt: Date;
  /** Whether this row is the owner who's currently looking at the list. */
  isYou: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Every owner account, oldest first, with `isYou` set against `currentEmail`. */
export async function listOwners(currentEmail: string, db?: Db): Promise<OwnerRow[]> {
  const database = db ?? (await getDb());
  const normalizedCurrent = normalizeEmail(currentEmail);

  const rows = await database
    .select({ email: user.email, name: user.name, createdAt: user.createdAt })
    .from(user)
    .orderBy(user.createdAt);

  return rows.map((row) => ({
    ...row,
    isYou: row.email.toLowerCase() === normalizedCurrent,
  }));
}

export type InviteOwnerResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: string; url: string }
  | { ok: false; error: string };

/**
 * Invites a new owner: creates their `user` row with no `account` at all,
 * then triggers Better Auth's own password-reset flow for that email —
 * `src/lib/betterAuth.ts`'s `sendResetPassword` sees the missing credential
 * account and sends an invite ("set your password") email instead of a
 * reset one. `captureResetSend` reports whether that email actually went
 * out, and the link itself when it didn't, so the settings page can say so
 * plainly rather than claim success it can't back up.
 */
export async function inviteOwner(email: string, db?: Db): Promise<InviteOwnerResult> {
  const database = db ?? (await getDb());
  const normalized = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const [existing] = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);
  if (existing) {
    return { ok: false, error: `${normalized} already has an owner account.` };
  }

  const name = normalized.split("@")[0] || normalized;
  await database.insert(user).values({
    id: randomUUID(),
    name,
    email: normalized,
    emailVerified: false,
  });

  const auth = await getAuth();
  const { outcome } = await captureResetSend(() =>
    auth.api.requestPasswordReset({ body: { email: normalized } }),
  );

  if (!outcome) {
    // Shouldn't happen — the `user` row above always makes
    // `requestPasswordReset` find a user and invoke `sendResetPassword` —
    // but never claim success this module can't prove happened.
    return { ok: false, error: "Could not generate an invite link. Try again." };
  }
  if (!outcome.sent) {
    return {
      ok: true,
      sent: false,
      reason: outcome.reason ?? "The email could not be sent.",
      url: outcome.url,
    };
  }
  return { ok: true, sent: true };
}

export type RemoveOwnerResult = { ok: true } | { ok: false; error: string };

/**
 * Removes an owner by email. Enforced here, not in the UI: an owner can't
 * remove themselves, and the last remaining owner can never be removed
 * (that would lock every owner out of `/admin` for good).
 */
export async function removeOwner(
  email: string,
  actingOwnerEmail: string,
  db?: Db,
): Promise<RemoveOwnerResult> {
  const database = db ?? (await getDb());
  const normalized = normalizeEmail(email);
  const acting = normalizeEmail(actingOwnerEmail);

  if (normalized === acting) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const rows = await database.select({ id: user.id, email: user.email }).from(user);
  const target = rows.find((row) => row.email.toLowerCase() === normalized);
  if (!target) {
    return { ok: false, error: "No owner with that email." };
  }
  if (rows.length <= 1) {
    return { ok: false, error: "You can't remove the last owner." };
  }

  await database.delete(user).where(eq(user.id, target.id));
  return { ok: true };
}
