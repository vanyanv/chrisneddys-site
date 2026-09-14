/**
 * The merch catalogue.
 *
 * Phase 1 of the Postgres-backed shop moved the source of truth to the
 * database (`src/db/schema.ts`), read through `src/lib/catalog.ts` — that is
 * the only module the app should read products through now. This file keeps
 * two jobs: `src/db/seed.ts` upserts the `merch` array below into the
 * database (so a product's copy still starts life here), and
 * `src/lib/catalog.ts` returns this same array unchanged whenever there is no
 * database to read from — a production build with no `DATABASE_URL` (CI, or
 * a preview deploy that has not been given one). The bag drawer
 * (`src/components/shop/BagDrawer.tsx`) also still reads this file directly,
 * client-side, and is out of scope for phase 1.
 *
 * Otter still lists a cap of its own — `chris-n-eddy-s-ball-cap-limited-run`
 * in `menu.ts` — but it is a different, older item and is left alone
 * deliberately: Otter's row keeps its own name, price and photo, and nothing
 * here reads from or writes to it any more. This file is the source of truth
 * for the actual shop: a price change here is a price change everywhere the
 * shop appears — the product page, the bag, the Product structured data and
 * the sitemap's `lastmod` all read from it.
 *
 * EVERY FIELD HERE IS A CLAIM THE BUSINESS HAS TO HONOUR. What is actually
 * known about the Foam Trucker is the name, the price, the run size, the
 * numbering, the construction details on the spec sheet, and that it ships
 * with a hand-signed certificate. Fabric weights not on that sheet, shipping
 * rates, delivery windows and a returns window are not known, so they are not
 * here and they are not on the page. A specification nobody has confirmed is a
 * promise to a customer that someone at the store has to keep.
 *
 * There is deliberately no stock count either. "Only 50 made" is honest
 * without one; a number that isn't decremented by a real till is a lie with a
 * countdown. The /50 mark is the real count, and it lives on the cap and the
 * certificate, not in a progress bar on this page.
 */

export type MerchView = {
  /** Stable id — React keys, and the `?view=` a real gallery would use. */
  id: string;
  /** Four characters or so; this is what a thumbnail is labelled with. */
  label: string;
  /** Read out under the main image, and the alt text for the artwork. */
  caption: string;
  /**
   * The real photograph for this angle, once it exists. `src` is a basename
   * (no extension) inside the product's `photoDir` — `${photoDir}/${src}.webp`
   * is the 720px-wide cut, `${photoDir}/${src}-thumb.webp` the 200px one, both
   * written by `scripts/build-shop-images.mjs`. `width`/`height` are the real
   * cut's pixel dimensions, used to set the frame's aspect ratio so the shot
   * is never cropped to fit a box built for a different photo.
   *
   * Left unset until the photography lands: an unset `photo` is what tells
   * `ProductShot` to draw `CapArt` instead, so the gallery is fully wired —
   * eight tabs, eight captions — before a single picture exists.
   *
   * `url`/`thumbUrl` are set instead of (never alongside a meaningful) `src`
   * for an image uploaded through /admin — a full Vercel Blob URL for each
   * cut. `ProductShot` prefers these over the `photoDir`-relative path when
   * present.
   */
  photo?: { src: string; width: number; height: number; url?: string; thumbUrl?: string };
};

/** A single authenticity-section image: the certificate, or the brim sticker. */
type AuthPhoto = {
  /** Basename inside the product's `photoDir`, same convention as `MerchView.photo`. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Same convention as `MerchView.photo.url`/`thumbUrl` — set for an uploaded image. */
  url?: string;
  thumbUrl?: string;
};

export type MerchProduct = {
  /**
   * The database row's id, when this product was read through
   * `src/lib/catalog.ts` from Postgres rather than from the array below.
   * Unset for the in-repo fallback/seed copy.
   */
  id?: string;
  /** The row's publication state in the database. Unset for the fallback copy. */
  status?: "draft" | "published" | "archived";
  /** URL slug: /shop/<slug>/ */
  slug: string;
  /** Exactly as it should appear on a receipt and in structured data. */
  name: string;
  /** Two lines for the product page's display heading, which is set in Bowlby. */
  displayName: [string, string];
  /**
   * US dollars. Carried over from the placeholder cap this product replaces —
   * the owner has not confirmed a price for the Foam Trucker yet. Update this
   * the moment a real number exists; nothing else on the page depends on it
   * being right today, but everything reads it as if it were.
   */
  price: number;
  /** The small kicker set above the product name — the drop's own label. */
  eyebrow: string;
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
   * Basename of a product photograph living in /public/menu, without
   * extension — the legacy path, for a product that shares Otter's asset.
   * The Foam Trucker doesn't: its shots live under `photoDir` instead. Kept
   * only so `ProductShot` and `productImage()` still work for a product built
   * the old way.
   */
  photo?: string;
  /**
   * Where this product's real photography lives, e.g. "/shop/foam-trucker-blue" —
   * `public/shop/foam-trucker-blue/`, written by `scripts/build-shop-images.mjs`
   * from source files in `assets/shop/foam-trucker-blue/`. Every `MerchView.photo`
   * and `authenticity` image is a basename inside this directory.
   */
  photoDir?: string;
  /**
   * Tint for the `CapArt` illustration that stands in for any view without a
   * photo yet — a CSS custom property, not a claim about the product, so it
   * costs nothing to get wrong. Leave unset for the ink-black default.
   */
  capColor?: string;
  /** Gallery angles. See `MerchView`. */
  views: MerchView[];
  /**
   * The construction list under "The details" — copied straight off the spec
   * sheet, one fact per line. Nothing paraphrased or inferred beyond it.
   */
  details?: string[];
  /** The one-paragraph fit note. */
  fit?: string;
  /** The "limited to 50" paragraph — the long version of `limitedNote`. */
  limitedCopy?: string;
  /** The "why this one" paragraph. */
  why?: string;
  /** The authenticity section's lead paragraph. */
  authenticityCopy?: string;
  /** The small label/value facts under the authenticity paragraph. */
  authenticityFacts?: { label: string; value: string }[];
  /**
   * The certificate and brim-sticker photographs for the authenticity
   * section. Optional at the type level for any product that ships without
   * one; left unset here until the scans exist, the same way an unset
   * `MerchView.photo` defers to the drawing.
   */
  authenticity?: { certificate: AuthPhoto; sticker: AuthPhoto };
};

/** The most of one item a single order will take. Keeps a run from being swept. */
export const MAX_PER_ORDER = 6;

/**
 * When this catalogue last changed. Drives `lastmod` on the shop URLs, so a
 * price change is a real signal to recrawl and an unchanged month is not.
 */
export const MERCH_UPDATED = "2026-09-13";

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
    slug: "foam-trucker-blue",
    name: "Chris N Eddy's Foam Trucker — Blue (Capsule 01)",
    displayName: ["THE FOAM TRUCKER", "— BLUE"],
    price: 48,
    eyebrow: "CNE Merch Capsule 01",
    description:
      "A royal-blue five-panel foam trucker from Chris N Eddy's, the smash-burger location on Sunset in Hollywood. Capsule 01 is limited to 50, each cap individually numbered. One size fits most.",
    metaDescription:
      "Chris N Eddy’s Foam Trucker — Blue, $48. Capsule 01, only 50 made, individually numbered /50. Royal-blue foam trucker with 3D puff embroidery. One size fits most.",
    limitedNote: "Only 50 made. Individually numbered /50. No restock, no second run.",
    oneSize: true,
    photoDir: "/shop/foam-trucker-blue",
    capColor: "#1f4bd6",
    views: [
      {
        id: "front",
        label: "FRONT",
        caption:
          "Front of the royal-blue Foam Trucker: yellow 3D puff CHRIS N EDDY’S embroidery with red outline, Cyclops button at wearer-left, /50 sticker on the bill",
        photo: { src: "front", width: 720, height: 720 },
      },
      {
        id: "front-plain",
        label: "FRONT",
        caption:
          "Front of the Foam Trucker without the bill sticker, showing the rope braid and embroidery",
        photo: { src: "front-plain", width: 720, height: 720 },
      },
      {
        id: "angle",
        label: "3/4",
        caption:
          "Three-quarter view of the Foam Trucker showing the blue mesh side panel and the /50 bill sticker",
        photo: { src: "angle", width: 720, height: 720 },
      },
      {
        id: "angle-plain",
        label: "3/4",
        caption:
          "Three-quarter view of the Foam Trucker from the wearer-left side, without the bill sticker",
        photo: { src: "angle-plain", width: 720, height: 720 },
      },
      {
        id: "cyclops",
        label: "BUTTON",
        caption: "Close-up of the blue Cyclops button pinned at wearer-left, beside the embroidery",
        photo: { src: "cyclops", width: 720, height: 720 },
      },
      {
        id: "stitch",
        label: "STITCH",
        caption:
          "Close-up of the raised yellow 3D puff embroidery, red outline and red LMTD. SUPPLY stitching above the rope braid",
        photo: { src: "stitch", width: 720, height: 720 },
      },
      {
        id: "snap",
        label: "SNAP",
        caption: "Close-up of the double-row blue snapback closure and mesh back",
        photo: { src: "snap", width: 720, height: 720 },
      },
      {
        id: "back",
        label: "BACK",
        caption: "Back of the Foam Trucker: full blue mesh crown and double-row snapback",
        photo: { src: "back", width: 720, height: 720 },
      },
    ],
    details: [
      "Royal-blue structured five-panel foam front",
      "Blue mesh back",
      "Raised yellow 3D puff CHRIS N EDDY’S embroidery with red dimensional outline",
      "Red LMTD. SUPPLY embroidery",
      "Matching blue Cyclops button at wearer-left",
      "Tonal blue rope braid across the front",
      "Pre-curved bill",
      "Double-row blue snapback closure",
      "Tear-away label",
      "Individually numbered limited-edition /50 bill sticker",
      "Hand-signed certificate of authenticity, issue number matched to the brim sticker",
      "Protected in retail-ready CNE packaging",
    ],
    fit: "Mid-profile, structured trucker fit with an adjustable double snapback. One size fits most.",
    limitedCopy:
      "Each hat is part of a 50-piece production run. The /50 mark is not decoration — it is the record of the capsule. No restock. No second run. No extras once the edition is gone.",
    why: "The Foam Trucker is the first physical marker of the CNE Merch Capsule: a wearable piece of the world, made for everyday use but produced like a limited artifact. Secure your number. Capsule 01 closes at 50.",
    authenticityCopy:
      "Every Foam Trucker leaves with a hand-signed certificate of authenticity. The issue number on the certificate is the same number on the /50 sticker on the brim, so the cap and its paper stay a pair. Keep it with the original item.",
    authenticityFacts: [
      { label: "Capsule", value: "CNE-01" },
      { label: "Class", value: "Retail headwear" },
      { label: "Origin", value: "Built in Los Angeles, CA · 2026" },
      { label: "Run", value: "50 made. No restock. No reissue." },
    ],
    authenticity: {
      // `scripts/build-shop-images.mjs` crops the certificate scan to the
      // card's own edge before resizing to a 720px width, so the published
      // image is the card, not the white field it sat in — 720x1116, not
      // square. `sticker` is square straight off the scan.
      certificate: {
        src: "certificate",
        width: 720,
        height: 1116,
        alt: "Hand-signed certificate of authenticity for Chris N Eddy’s Foam Trucker — Blue, Capsule 01",
      },
      sticker: {
        src: "sticker",
        width: 720,
        height: 720,
        alt: "Individually numbered limited-edition /50 sticker from the Foam Trucker’s brim",
      },
    },
  },
];

/** The catalogue is tiny, so a scan is cheaper than an index. */
export function productBySlug(slug: string): MerchProduct | undefined {
  return merch.find((p) => p.slug === slug);
}
