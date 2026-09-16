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

/**
 * The shop's scarcity flag — the shop index card's flag, the product page's
 * marquee word and its limited chip all read from this, so none of the
 * three can say a run size the live inventory doesn't back. `editionSize`
 * is `InventoryStatus.editionSize` (`src/lib/catalog.ts`): a real number for
 * a tracked edition product, `null` for anything untracked or without one.
 */
export function editionFlag(editionSize: number | null): string {
  return editionSize !== null ? `ONLY ${editionSize} MADE` : "LIMITED RUN";
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

  // Optional, and deliberately its own sentence rather than a fourth
  // `facts` entry: "Ships flat $8 in the US · free over $75 · Ships within
  // 3 business days." reads as though "Ships" were a fact of the same kind
  // as the other two, when it's really a separate promise about timing.
  // Unset, the line reads exactly as it always has — no dangling clause,
  // no trailing "Ships within .".
  const shipsWithin = settings.shipsWithin?.trim();
  const line = shipsWithin
    ? `${facts.join(" · ")}. Ships within ${shipsWithin}.`
    : `${facts.join(" · ")}.`;

  return {
    line,
    hasTerms: Boolean(settings.termsText?.trim()),
  };
}

// ---------------------------------------------------------------------------
// Pause — a deliberate, temporary "the counter's closed" state the owner
// flips on and off from `/admin/settings` (`shopPaused`/`pauseNote` on
// `StoreSettings`). Kept out of the pre-launch copy above on purpose: a shop
// that has never opened and a shop taking a few days off are different
// facts, and saying either one in the other's words would tell a buyer
// something false about which one is true. See `isShopPausedFor`
// (`shopStatus.ts`) for why the two states aren't merged into one flag.
// ---------------------------------------------------------------------------

export type PauseNotice = {
  /** The bold line above the paragraph — fixed, never composed from the
   * owner's note, so it reads the same on every paused product page. */
  heading: string;
  /** The explanatory paragraph. Holds together as one sentence-flow whether
   * or not the owner set a note, so the banner never reads as a half
   * sentence with nothing filled in. */
  body: string;
};

/** The pause banner a product page shows in place of its usual availability
 * copy once `isShopPausedFor` is true. `pauseNote` is the owner's optional
 * short line ("Back Thursday") — folded into the fixed sentence around it
 * rather than replacing it, so the promise ("your number will still be
 * there") is said every time, note or no note. */
export function pauseNotice(pauseNote: string | null): PauseNotice {
  const note = pauseNote?.trim();
  return {
    heading: "The shop's shut for a couple of days.",
    body: `We're restocking the counter and nobody's here to pack boxes.${
      note ? ` ${note}.` : ""
    } Your number will still be there.`,
  };
}

/** The label the disabled buy button carries while paused — the owner's own
 * note when they've set one ("BACK THURSDAY"), or a plain fallback when they
 * haven't. Uppercased to match every other state this button carries
 * (`ADD TO BAG`, `SOLD OUT`), which are typeset in caps rather than styled
 * with `text-transform`. */
export function pauseButtonLabel(pauseNote: string | null): string {
  const note = pauseNote?.trim();
  return note ? note.toUpperCase() : "SHOP PAUSED";
}

/**
 * The checkout API's refusal message while paused (`POST /api/checkout`) —
 * short, since it surfaces as a form-level error under the bag drawer's
 * checkout button (`BagDrawer`'s generic `checkoutError` paragraph) rather
 * than as a card of copy the way `pauseNotice` renders on the product page.
 * Carries the same owner's note, so a customer who already had something in
 * their bag from before the pause started sees the same promise there too.
 */
export function pauseCheckoutMessage(pauseNote: string | null): string {
  const note = pauseNote?.trim();
  return `The shop's paused right now.${note ? ` ${note}.` : ""} Your bag is saved — come back soon.`;
}
