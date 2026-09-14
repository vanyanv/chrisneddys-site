/**
 * Composes the shop's "Shipping & returns" line from the owner's real
 * settings (`src/lib/orders.ts`'s `StoreSettings`), for the shop index and
 * the product page to render next to the buy controls. Returns `null` until
 * a returns policy is actually set — `TERMS_PENDING`
 * (`src/data/merch.ts`) stays on the page until then, so the site never
 * states a shipping rate or a pickup address without also pointing at the
 * refund policy California Civil Code §1723 requires be shown before
 * purchase.
 *
 * Kept a plain string/boolean composer (no JSX) so it is unit-testable
 * without a DOM, and so the two call sites can each wrap the same facts in
 * their own markup and `<Link>`s.
 */
import type { StoreSettings } from "@/lib/orders";

/** `600` -> "$6", `675` -> "$6.75" — no trailing ".00" for a round number. */
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Collapses a multi-line pickup address into one comma-separated line. */
function singleLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

export type ShippingReturnsNote = {
  /** e.g. "Ships flat $6 in the US · free over $75 · or pick up at 5539 W. Sunset Blvd." */
  line: string;
  /** Whether a terms-of-sale page is also worth linking alongside returns. */
  hasTerms: boolean;
};

/**
 * `null` when there's no returns policy set yet — California law requires
 * the refund policy be shown before purchase, so nothing here composes a
 * shipping/pickup claim without a policy to stand next to it.
 */
export function shippingReturnsNote(settings: StoreSettings): ShippingReturnsNote | null {
  if (!settings.returnsPolicy?.trim()) return null;

  const facts: string[] = [];

  const countries = settings.shipCountries;
  const destination =
    countries.length === 1 && countries[0] === "US" ? "in the US" : `to ${countries.join(", ")}`;
  facts.push(`Ships flat ${formatDollars(settings.shippingFlatCents)} ${destination}`);

  if (settings.shippingFreeOverCents !== null) {
    facts.push(`free over ${formatDollars(settings.shippingFreeOverCents)}`);
  }

  const pickupAddress = singleLine(settings.pickupAddress);
  if (settings.pickupEnabled && pickupAddress) {
    facts.push(`or pick up at ${pickupAddress}`);
  }

  return {
    line: `${facts.join(" · ")}.`,
    hasTerms: Boolean(settings.termsText?.trim()),
  };
}
