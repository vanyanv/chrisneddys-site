/**
 * The merch catalogue.
 *
 * Otter carries the cap too, as `chris-n-eddy-s-ball-cap-limited-run` in
 * `menu.ts`, which is where its photograph comes from. What Otter cannot do is
 * a merch browse: a hat filed between the shakes and the fries is not a shop.
 * So this file is the source of truth for everything except the photo, and a
 * price change here is a price change everywhere: the product page, the bag,
 * the Product structured data and the sitemap's `lastmod` all read from it.
 *
 * The one number that has to agree with Otter is the price. If they diverge,
 * `menu.ts` is what the till charges.
 *
 * EVERY FIELD HERE IS A CLAIM THE BUSINESS HAS TO HONOUR. Four things about
 * this cap are actually known — the name, the price, that the run is limited,
 * and that it is one size. Fabric weights, shipping rates, delivery windows and
 * a returns window are not known, so they are not here and they are not on the
 * page. A specification nobody has confirmed is a promise to a customer that
 * someone at the store has to keep.
 *
 * There is deliberately no stock count either. "Limited quantity" is honest
 * without one; a number that isn't decremented by a real till is a lie with a
 * countdown.
 */

export type MerchView = {
  /** Stable id — React keys, and the `?view=` a real gallery would use. */
  id: string;
  /** Four characters or so; this is what a thumbnail is labelled with. */
  label: string;
  /** Read out under the main image, and the alt text for the artwork. */
  caption: string;
};

export type MerchProduct = {
  /** URL slug: /shop/<slug>/ */
  slug: string;
  /** Exactly as it should appear on a receipt and in structured data. */
  name: string;
  /** Two lines for the product page's display heading, which is set in Bowlby. */
  displayName: [string, string];
  /** US dollars. */
  price: number;
  /** Sentence-length. Feeds the Product schema and the page copy. */
  description: string;
  /**
   * The search snippet. Written to fit, not derived: Google renders about 155
   * characters. Lead with the name and the price, because that is what makes a
   * merch result worth tapping.
   */
  metaDescription: string;
  /** The scarcity line. Replaces the size grid a one-size product doesn't need. */
  limitedNote: string;
  /** Sold as one size — set false the day a product has variants. */
  oneSize: boolean;
  /**
   * Basename of the product photograph in /public/menu, without extension —
   * the same Otter asset the menu row uses, so there is one file and one
   * upload rather than a second copy that drifts. `<photo>-thumb.webp` is the
   * 200px cut, `<photo>.webp` the 720px one.
   */
  photo?: string;
  /**
   * Gallery angles. One entry means one image and no thumbnail strip: there is
   * one photograph, and four labelled "views" of it would be describing angles
   * nobody has shot. Add entries when more shots exist.
   */
  views: MerchView[];
};

/**
 * Whether the shop can take money.
 *
 * False until a payment processor is connected. It disables the checkout
 * button, and it is why the Product schema states a price without claiming the
 * item is available to buy — a merchant listing for something no one can
 * actually purchase is the search-result equivalent of a locked door.
 */
export const SHOP_OPEN = false;

/** The most of one item a single order will take. Keeps a run from being swept. */
export const MAX_PER_ORDER = 6;

/**
 * When this catalogue last changed. Drives `lastmod` on the shop URLs, so a
 * price change is a real signal to recrawl and an unchanged month is not.
 */
export const MERCH_UPDATED = "2026-09-10";

/**
 * What is not settled yet, said once, in the place a buyer would look for it.
 * Replace with the real terms; do not delete without replacing.
 */
export const TERMS_PENDING =
  "Shipping, delivery times and returns are still being worked out. They’ll be on this page before the shop opens.";

/**
 * A product's first view — the gallery's default and what card art uses.
 * Every product in the catalogue below is defined with at least one view;
 * this only throws if that contract is ever broken.
 */
export function firstView(product: MerchProduct): MerchView {
  const view = product.views[0];
  if (!view) throw new Error(`${product.slug} has no views`);
  return view;
}

export const merch: MerchProduct[] = [
  {
    slug: "ball-cap",
    name: "Chris N Eddy's Ball-Cap (Limited Run)",
    displayName: ["CHRIS N EDDY’S", "BALL-CAP"],
    price: 48,
    description:
      "A limited-run ball-cap from Chris N Eddy's, the smash-burger location on Sunset in Hollywood. One size fits all.",
    metaDescription:
      "Chris N Eddy’s Ball-Cap — $48, one size fits all, limited quantity. A limited run from the Hollywood smash-burger location.",
    limitedNote: "Limited quantity. Once they’re gone, they’re gone.",
    oneSize: true,
    photo: "6cff1a91-e6d5-4bad-adc6-e62bc26f19cf",
    views: [
      {
        id: "cap",
        label: "CAP",
        caption: "Navy trucker cap with the Chris N Eddy’s wordmark embroidered on the front",
      },
    ],
  },
];

/** The catalogue is tiny, so a scan is cheaper than an index. */
export function productBySlug(slug: string): MerchProduct | undefined {
  return merch.find((p) => p.slug === slug);
}

/** `$48.00`. Used everywhere a price is printed, so rounding happens once. */
export function money(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}
