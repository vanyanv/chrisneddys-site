"use server";

import { headers } from "next/headers";
import { applySetCookieHeader, requireOwner } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { inviteOwner, removeOwner } from "@/lib/owners";
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
 * Changes the signed-in owner's password via `auth.api.changePassword`,
 * always revoking every other session — a change-password card that leaves
 * a stolen session logged in isn't much of a security control. A wrong
 * current password throws (Better Auth's `INVALID_PASSWORD`); every failure
 * path returns the same generic message rather than distinguishing it,
 * since a caller who's already signed in as this owner has no other use for
 * that distinction.
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
    const { headers: outHeaders } = await auth.api.changePassword({
      headers: headerList,
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      returnHeaders: true,
    });
    await applySetCookieHeader(outHeaders.get("set-cookie"));
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
      at: new Date().toISOString(),
    };
  }
  return { ok: true, sent: true, at: new Date().toISOString() };
}

export type RemoveOwnerState = {
  ok?: boolean;
  error?: string;
  at?: string;
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
  return { ok: true, at: new Date().toISOString() };
}
