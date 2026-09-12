/**
 * One conversion event, reported to both analytics tools.
 *
 * GA4 is where these are turned into key events and joined to campaigns;
 * Plausible already counts outbound clicks on its own, so the named events sent
 * here are what let a Plausible goal separate "tapped ORDER in the dock" from
 * "tapped ORDER in the hero" — a distinction its outbound-link extension
 * cannot make, because both go to the same URL.
 *
 * Every event here is an *intent* signal except `contact_submit` and
 * `notify_signup`. None of them is a purchase: the sale happens on Otter, on a
 * domain this tag cannot reach, and the shop cannot take payment yet. Naming
 * them `*_click` rather than `conversion` is deliberate — the number people
 * report should not be able to be mistaken for revenue.
 */

type Primitive = string | number | boolean | undefined;

/** GA4's recommended ecommerce line item. Only the shop events carry these. */
export type TrackItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

/**
 * GA4 takes nested arrays; Plausible takes flat scalars only. A value that is
 * neither a scalar nor an `items` array has nowhere sensible to go.
 */
type ParamValue = Primitive | TrackItem[];

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
  | "contact_submit"
  /** The guest check could not be sent. Carries a reason, never a message. */
  | "contact_error"
  /** Joined the opening list for a store that has not opened yet. */
  | "notify_signup"
  /** The opening-list signup could not be sent. */
  | "notify_error"
  /** Landed on a product page in the shop. */
  | "view_item"
  /** Put something in the bag. */
  | "add_to_cart"
  /** Opened the bag. */
  | "view_cart";

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
export function track(event: TrackEvent, params: Record<string, ParamValue> = {}): void {
  if (typeof window === "undefined") return;

  // Drop empty values rather than sending "undefined" as a dimension.
  const props: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") props[k] = v;
  }

  try {
    // `beacon` rather than GA4's default transport, so a hit survives the page
    // being unloaded. Today every order/directions link opens in a new tab and
    // nothing is lost; the point is that adding a same-tab link tomorrow must
    // not silently start dropping conversions.
    window.gtag?.("event", event, { ...props, transport_type: "beacon" });
  } catch {
    /* analytics must never break the page */
  }

  try {
    // Plausible's custom properties are flat strings and numbers — an array
    // would be dropped or stringified into a useless dimension, so the items
    // list is left out and only the scalars go over.
    const flat: Record<string, Primitive> = {};
    for (const [k, v] of Object.entries(props)) {
      if (!Array.isArray(v)) flat[k] = v;
    }
    window.plausible?.(event, Object.keys(flat).length ? { props: flat } : undefined);
  } catch {
    /* as above */
  }
}
