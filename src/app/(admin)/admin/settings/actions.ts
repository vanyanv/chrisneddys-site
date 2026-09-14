"use server";

import { saveStoreSettings } from "@/lib/settingsAdmin";
import type { StoreSettingsPatch } from "@/lib/orders";

export type SaveSettingsState = {
  ok?: boolean;
  error?: string;
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

  const savedAt = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { ok: true, savedAt };
}
