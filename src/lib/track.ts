/**
 * One conversion event, reported to both analytics tools.
 *
 * GA4 is where these are turned into key events and joined to campaigns;
 * Plausible already counts outbound clicks on its own, so the named events sent
 * here are what let a Plausible goal separate "tapped ORDER in the dock" from
 * "tapped ORDER in the hero" — a distinction its outbound-link extension
 * cannot make, because both go to the same URL.
 *
 * Every event here is an *intent* signal except `contact_submit`. None of them
 * is a purchase: the sale happens on Otter, on a domain this tag cannot reach.
 * Naming them `*_click` rather than `conversion` is deliberate — the number
 * people report should not be able to be mistaken for revenue.
 */

type Primitive = string | number | boolean | undefined;

export type TrackEvent =
  /** Left for the Otter storefront, ready to buy. */
  | "order_click"
  /** Left for a third-party delivery platform. */
  | "delivery_click"
  /** Tapped the phone number. */
  | "call_click"
  /** Tapped through to turn-by-turn directions. */
  | "directions_click"
  /** Opened an item's sheet on the menu — choosing food, not yet leaving. */
  | "menu_item_open"
  /** Sent the guest check on /contact/. */
  | "contact_submit";

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    plausible?: (event: string, opts?: { props?: Record<string, Primitive> }) => void;
  }
}

/**
 * Fire and forget. Never throws, and never blocks a navigation: the anchor's
 * default action is left alone, so a click that leaves the page still leaves it
 * even if both tags are blocked, slow or absent.
 */
export function track(event: TrackEvent, params: Record<string, Primitive> = {}): void {
  if (typeof window === "undefined") return;

  // Drop empty values rather than sending "undefined" as a dimension.
  const props: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") props[k] = v;
  }

  try {
    window.gtag?.("event", event, props);
  } catch {
    /* analytics must never break the page */
  }

  try {
    window.plausible?.(event, Object.keys(props).length ? { props } : undefined);
  } catch {
    /* as above */
  }
}
