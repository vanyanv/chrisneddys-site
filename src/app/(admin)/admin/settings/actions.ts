"use server";

import { headers } from "next/headers";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireOwner } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { inviteOwner, removeOwner, type OwnerRow } from "@/lib/owners";
import {
  finishPasskeyEnrollment,
  listOwnerPasskeys,
  removeOwnerPasskey,
  startPasskeyEnrollment,
  type FinishEnrollmentResult,
  type OwnerPasskey,
  type StartEnrollmentResult,
} from "@/lib/passkeys";
import { saveStoreSettings } from "@/lib/settingsAdmin";
import type { StoreSettingsPatch } from "@/lib/orders";

/** Minimum length for a new owner password — matches
 * `scripts/owner-password.mjs`'s `MIN_PASSWORD_LENGTH`. Better Auth's own
 * `changePassword` has no length floor of its own to lean on here. */
const MIN_NEW_PASSWORD_LENGTH = 12;

export type SaveSettingsState = {
  ok?: boolean;
  error?: string;
  /** ISO timestamp — formatted client-side (`SettingsForm`) so it renders in
   * the viewer's local time instead of the server's (UTC on Vercel). */
  savedAt?: string;
  /** Per-field messages, keyed by the form field name, for `adm-field-error`. */
  fieldErrors?: Record<string, string>;
};

const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

function parseCountries(raw: string): string[] {
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

export async function saveSettingsAction(
  _prevState: SaveSettingsState | undefined,
  formData: FormData,
): Promise<SaveSettingsState> {
  await requireOwner();

  const fieldErrors: Record<string, string> = {};

  const storeName = String(formData.get("storeName") ?? "").trim();
  if (!storeName) fieldErrors.storeName = "Give the store a name.";

  const supportEmail = String(formData.get("supportEmail") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    fieldErrors.supportEmail = "Enter a valid email address.";
  }

  const pickupEnabled = formData.get("pickupEnabled") === "on";
  const pickupAddress = String(formData.get("pickupAddress") ?? "").trim();

  const flatRaw = String(formData.get("shippingFlatDollars") ?? "").trim();
  const flatDollars = Number(flatRaw);
  if (flatRaw === "" || !Number.isFinite(flatDollars) || flatDollars < 0) {
    fieldErrors.shippingFlatDollars = "Enter a flat shipping rate of $0 or more.";
  }

  const freeOverRaw = String(formData.get("shippingFreeOverDollars") ?? "").trim();
  let shippingFreeOverCents: number | null = null;
  if (freeOverRaw !== "") {
    const freeOverDollars = Number(freeOverRaw);
    if (!Number.isFinite(freeOverDollars) || freeOverDollars < 0) {
      fieldErrors.shippingFreeOverDollars = "Leave this blank, or enter $0 or more.";
    } else {
      shippingFreeOverCents = Math.round(freeOverDollars * 100);
    }
  }

  const shipCountries = parseCountries(String(formData.get("shipCountries") ?? ""));
  if (shipCountries.length === 0) {
    fieldErrors.shipCountries = "List at least one ISO-2 country code, e.g. US.";
  } else {
    const bad = shipCountries.find((c) => !COUNTRY_PATTERN.test(c));
    if (bad !== undefined) {
      fieldErrors.shipCountries = `"${bad}" isn't a two-letter country code.`;
    }
  }

  const returnsPolicy = String(formData.get("returnsPolicy") ?? "").trim();
  const termsText = String(formData.get("termsText") ?? "").trim();

  // Optional — folded into `shopCopy.ts`'s shipping sentence only when set.
  // Length is also enforced server-side in `updateStoreSettings` (the
  // source of truth), same pattern as the pause note below.
  const shipsWithin = String(formData.get("shipsWithin") ?? "").trim();
  if (shipsWithin.length > 60) {
    fieldErrors.shipsWithin = 'Keep "Ships within" under 60 characters.';
  }

  // issue #43: the pause toggle and its optional note. Length is also
  // enforced server-side in `updateStoreSettings` (the source of truth for
  // validation) — this is just where a bad value becomes a labelled field
  // error instead of the form's generic top-level one.
  const shopPaused = formData.get("shopPaused") === "on";
  const pauseNote = String(formData.get("pauseNote") ?? "").trim();
  if (pauseNote.length > 140) {
    fieldErrors.pauseNote = "Keep the pause note under 140 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const patch: StoreSettingsPatch = {
    storeName,
    supportEmail,
    pickupEnabled,
    pickupAddress,
    shippingFlatCents: Math.round(flatDollars * 100),
    shippingFreeOverCents,
    shipCountries,
    returnsPolicy: returnsPolicy || null,
    termsText: termsText || null,
    shipsWithin: shipsWithin || null,
    shopPaused,
    pauseNote: pauseNote || null,
  };

  const result = await saveStoreSettings(patch);
  if (!result.ok) return { error: result.error };

  return { ok: true, savedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export type ChangePasswordState = {
  ok?: boolean;
  error?: string;
  /** ISO timestamp of a successful change — see `SaveSettingsState.savedAt`. */
  savedAt?: string;
};

/**
 * Changes the signed-in owner's password via `auth.api.changePassword`, then
 * revokes every *other* session via Better Auth's dedicated
 * `/revoke-other-sessions` endpoint (`auth.api.revokeOtherSessions`) — a
 * change-password card that leaves a stolen session logged in isn't much of
 * a security control.
 *
 * Deliberately **not** `changePassword`'s own `revokeOtherSessions: true`
 * body flag: despite the name, that flag revokes *every* session for the
 * user — the caller's current one included (see
 * `node_modules/better-auth/dist/api/routes/update-user.mjs`'s
 * `changePassword` handler: `revokeOtherSessions` triggers
 * `deleteUserSessions` unconditionally, then mints a brand-new session and a
 * fresh `Set-Cookie` for it). That cookie only reaches the browser on the
 * response to *this* request; the admin layout's `requireOwner()` re-render
 * that follows a server action happens within the same request and reads
 * the cookies the request *arrived* with — the now-deleted session — so it
 * redirects to sign-in, and the client then loops on that redirect. Calling
 * `revokeOtherSessions` (the endpoint) separately, after `changePassword`
 * with no such flag, revokes only sessions other than the caller's current
 * one — see that same source file's `/revoke-other-sessions` handler, which
 * filters `session.token !== ctx.context.session.session.token` — so the
 * caller's session token never changes and no cookie swap is needed at all.
 *
 * A wrong current password throws (Better Auth's `INVALID_PASSWORD`); every
 * failure path returns the same generic message rather than distinguishing
 * it, since a caller who's already signed in as this owner has no other use
 * for that distinction.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  await requireOwner();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_NEW_PASSWORD_LENGTH} characters for the new password.` };
  }

  const auth = await getAuth();
  const headerList = await headers();

  try {
    await auth.api.changePassword({
      headers: headerList,
      body: { currentPassword, newPassword },
    });
    await auth.api.revokeOtherSessions({ headers: headerList });
  } catch {
    return { error: "That current password isn't right." };
  }

  return { ok: true, savedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

export type InviteOwnerState = {
  ok?: boolean;
  error?: string;
  sent?: boolean;
  reason?: string;
  url?: string;
  /** ISO timestamp of a successful invite — lets the client tell "the same
   * result rendered again" apart from "a fresh invite just went through". */
  at?: string;
  /** The owner row just created, so the card can list them immediately
   * rather than waiting on `/admin/settings` to re-render (#38). */
  owner?: OwnerRow;
};

/** Invites a new owner by email — see `inviteOwner` (`@/lib/owners`) for
 * the create-user-then-reset mechanics and every rule this enforces. */
export async function inviteOwnerAction(
  _prevState: InviteOwnerState | undefined,
  formData: FormData,
): Promise<InviteOwnerState> {
  await requireOwner();

  const email = String(formData.get("email") ?? "").trim();
  const result = await inviteOwner(email);

  if (!result.ok) return { error: result.error };
  if (!result.sent) {
    return {
      ok: true,
      sent: false,
      reason: result.reason,
      url: result.url,
      owner: result.owner,
      at: new Date().toISOString(),
    };
  }
  return { ok: true, sent: true, owner: result.owner, at: new Date().toISOString() };
}

export type RemoveOwnerState = {
  ok?: boolean;
  error?: string;
  at?: string;
  /** The address just removed, so the card can drop the row immediately
   * rather than waiting on `/admin/settings` to re-render (#38). */
  email?: string;
};

/** Removes an owner by email — see `removeOwner` (`@/lib/owners`) for the
 * last-owner and self-removal rules this enforces. */
export async function removeOwnerAction(
  _prevState: RemoveOwnerState | undefined,
  formData: FormData,
): Promise<RemoveOwnerState> {
  const session = await requireOwner();

  const email = String(formData.get("email") ?? "").trim();
  const result = await removeOwner(email, session.email);

  if (!result.ok) return { error: result.error };
  return { ok: true, email, at: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Passkeys (issue #51) — called directly from `PasskeysCard.tsx`, not bound
// to a `<form>`: enrollment is a two-step ceremony (a WebAuthn prompt in the
// browser runs between the "start" and "finish" calls), which
// `useActionState`'s single form-submit-to-result shape has no room for.
// ---------------------------------------------------------------------------

/** The signed-in owner's registered passkeys, newest first — read on every
 * call rather than cached, so the card always shows what's actually stored. */
export async function listPasskeysAction(): Promise<OwnerPasskey[]> {
  await requireOwner();
  return listOwnerPasskeys();
}

/** Step 1 of adding a passkey — see `startPasskeyEnrollment`
 * (`@/lib/passkeys`) for what the challenge is and how step 2 reads it
 * back. `requireOwner()` here is the whole security property of enrolment:
 * a passkey can only ever be added from inside an already-authenticated
 * session, so getting one registered is never a way *in*. */
export async function startAddPasskeyAction(name?: string): Promise<StartEnrollmentResult> {
  await requireOwner();
  return startPasskeyEnrollment(name);
}

/** Step 2 of adding a passkey: hands the authenticator's attestation back
 * for verification — see `finishPasskeyEnrollment` (`@/lib/passkeys`).
 * Gated on `requireOwner()` for the same reason step 1 is, and separately
 * from it: the two halves are separate requests, so checking only the
 * first would leave the one that actually writes the credential open. */
export async function finishAddPasskeyAction(
  response: RegistrationResponseJSON,
  name?: string,
): Promise<FinishEnrollmentResult> {
  await requireOwner();
  return finishPasskeyEnrollment(response, name);
}

/** Removes one of the signed-in owner's passkeys — see
 * `removeOwnerPasskey` (`@/lib/passkeys`), which deliberately allows
 * removing the last one, since the password path never stops working.
 * Ownership of `id` is checked by Better Auth's own endpoint rather than
 * here, so this only has to establish that *some* owner is signed in. */
export async function removePasskeyAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOwner();
  return removeOwnerPasskey(id);
}
