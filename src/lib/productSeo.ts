import { brand } from "@/data/brand";
import { formatPrice } from "@/lib/otter";
import { customerFacingProductName } from "@/lib/productName";

/**
 * Every product's search-engine fields, whether or not anyone wrote them.
 *
 * The admin lets an owner write a page title, a search snippet, keywords and
 * the alt text for the share picture. None of them is required, and a product
 * created from The Rack's "New product" button has none of them — so the
 * storefront cannot read those columns directly or a new product would go live
 * with an empty `<title>` and no snippet at all.
 *
 * So the columns are treated as overrides, not as the source of truth:
 * `resolveProductSeo` returns what the owner wrote where they wrote something
 * and a line derived from the product itself where they did not. That is what
 * makes "add a product and it already has its SEO" true with no API key, no
 * network call and nothing for the owner to remember. Where a model is
 * configured (`src/lib/seoWriter.ts`) it writes better copy into the same
 * columns at creation time; this file is what happens when it has not, or
 * cannot.
 *
 * Kept pure and DB-free so both the storefront and the admin can call it, and
 * so the derived lines can be unit-tested against the character budgets Google
 * actually renders: roughly 60 for a title, 155 for a description.
 */

/** The title budget Google renders before truncating, which the admin also enforces. */
export const TITLE_LIMIT = 60;
/** The snippet budget, matching the existing `metaDescription` rule. */
export const DESCRIPTION_LIMIT = 155;
/** Keywords are a short comma-separated line, not an essay. */
export const KEYWORDS_LIMIT = 160;
/** Alt text reads aloud, so it is a sentence and not a paragraph. */
export const IMAGE_ALT_LIMIT = 125;

/**
 * The product fields this file reads, stated structurally so both shapes can
 * be passed: `MerchProduct` from the storefront (which carries `displayName`
 * as a two-line tuple) and `AdminProduct` from the admin (which carries the
 * two lines separately, and may have any of them blank).
 */
export type ProductSeoInput = {
  slug: string;
  name?: string | null;
  displayName?: readonly [string, string];
  displayName1?: string | null;
  displayName2?: string | null;
  /** US dollars, the way `MerchProduct.price` carries it. */
  price?: number | null;
  eyebrow?: string | null;
  description?: string | null;
  metaDescription?: string | null;
  limitedNote?: string | null;
  metaTitle?: string | null;
  metaKeywords?: string | null;
  socialImageUrl?: string | null;
  socialImageAlt?: string | null;
};

/** What a page actually needs. Every field is non-empty. */
export type ProductSeo = {
  title: string;
  description: string;
  /** Empty when there is nothing honest to say — `keywords` is optional metadata. */
  keywords: string[];
  /** Root-relative or absolute; never a path that nobody has produced. */
  imageUrl: string;
  imageAlt: string;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Cut to a budget on a word boundary rather than mid-word, because a snippet
 * ending "…the Foam Truck" reads like a mistake where "…the Foam" reads like
 * an edit. Only ever shortens; a line already inside its budget is returned
 * untouched.
 */
function fit(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "");
}

/**
 * The name metadata should use — a `<title>`, a snippet, a schema `name`.
 *
 * Not `customerFacingProductName`, which prefers the display lines because
 * those are what the customer saw on the page and what a receipt has to say.
 * Metadata wants the other order: the display lines are set in Bowlby for the
 * product page's heading and written in caps to suit it ("THE FOAM TRUCKER",
 * "— BLUE"), and a title or a structured-data name in shouting caps reads as
 * spam rather than as a product. So `name` wins where a product has one — it is
 * the line written to appear on a receipt and in structured data — and the
 * display lines are the fallback for anything the current admin created, which
 * never fills `name` in at all.
 */
export function productMetadataName(product: ProductSeoInput): string {
  const receipt = clean(product.name);
  if (receipt) return receipt;

  return customerFacingProductName({
    displayName1: product.displayName1 ?? product.displayName?.[0],
    displayName2: product.displayName2 ?? product.displayName?.[1],
  });
}

/**
 * A title reads "<name> — $48", the same shape the product page has always
 * built inline, with the parenthetical colour dropped: `name` on the seeded
 * product is "The Foam Trucker (Blue)" and a title has 60 characters to spend.
 */
function draftTitle(product: ProductSeoInput): string {
  const name = productMetadataName(product).replace(/\s*\(.*\)\s*$/, "");
  const price = typeof product.price === "number" && product.price > 0 ? product.price : null;
  return fit(price ? `${name} — ${formatPrice(price)}` : name, TITLE_LIMIT);
}

/**
 * A snippet leads with the name and the price, then whatever concrete detail
 * the product carries — the scarcity line first, since "only 50 made" is the
 * reason a merch result is worth tapping, then the product's own sentence.
 */
function draftDescription(product: ProductSeoInput): string {
  // Returned exactly as written. The budgets below are for the lines this file
  // composes, where it can choose the length; a snippet somebody sat and wrote
  // is not improved by being cut four characters short of where Google would
  // cut it anyway, and the admin already refuses one over 155 on the way in.
  const written = clean(product.metaDescription);
  if (written) return written;

  const name = productMetadataName(product);
  const price = typeof product.price === "number" && product.price > 0 ? product.price : null;
  const opening = price ? `${name}, ${formatPrice(price)}` : name;
  const rest = [clean(product.limitedNote), clean(product.description)].filter(Boolean);
  const tail = rest.length ? ` ${rest.join(" ")}` : ` Merch from ${brand.name}.`;
  return fit(`${opening}.${tail}`, DESCRIPTION_LIMIT);
}

/**
 * Keywords carry no ranking weight on their own and are not invented here:
 * every term is something already true of the product — its own name, the
 * drop's label, the brand — so the line can never claim more than the page.
 */
function draftKeywords(product: ProductSeoInput): string[] {
  const terms = [productMetadataName(product), clean(product.eyebrow), brand.name, "merch"];
  return dedupeTerms(terms);
}

function dedupeTerms(terms: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const value = clean(term);
    if (!value || value === "Untitled product") continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Parses the stored comma-separated line back into terms. */
export function parseKeywords(stored: string | null | undefined): string[] {
  return dedupeTerms(clean(stored).split(","));
}

/**
 * The share picture.
 *
 * An owner can point this at an uploaded image. Where they have not, it is the
 * card drawn per product by `shop/[product]/social-card` — which is why this
 * never falls back to `/shop/<slug>.png`: that file is rendered by a script run
 * by hand, so for every product added through the admin it is a 404, and a 404
 * in an `og:image` is a share that previews as a broken box.
 *
 * The one place this URL is built. The Open Graph tag, the Twitter tag,
 * `Product.image` and the sitemap all name the same card, and a trailing slash
 * because `next.config.mjs` sets `trailingSlash`.
 */
export function productSocialImage(product: ProductSeoInput): string {
  const owner = clean(product.socialImageUrl);
  if (owner) return owner.startsWith("/") ? `${brand.siteUrl}${owner}` : owner;
  return `${brand.siteUrl}/shop/${product.slug}/social-card/`;
}

/** Alt text describes the card, so it says what the card actually shows. */
function draftImageAlt(product: ProductSeoInput): string {
  const name = productMetadataName(product);
  const price = typeof product.price === "number" && product.price > 0 ? product.price : null;
  return fit(
    price ? `${name} — ${formatPrice(price)}` : `${name} from ${brand.name}`,
    IMAGE_ALT_LIMIT,
  );
}

/**
 * What the owner wrote, or what the product implies. Called by every shop page
 * that puts a product in `<head>`.
 */
export function resolveProductSeo(product: ProductSeoInput): ProductSeo {
  const written = clean(product.metaTitle);
  const keywords = parseKeywords(product.metaKeywords);
  const alt = clean(product.socialImageAlt);
  return {
    // As written, for the same reason as the description above.
    title: written || draftTitle(product),
    description: draftDescription(product),
    keywords: keywords.length ? keywords : draftKeywords(product),
    imageUrl: productSocialImage(product),
    imageAlt: alt || draftImageAlt(product),
  };
}

/**
 * The same four lines as values to *store*, for the moment a product is
 * created: a product whose columns are filled reads the same as one relying on
 * the fallbacks above, but the owner can see the words and edit them, which is
 * the whole point of the fields. `seoWriter.ts` replaces these where a model
 * is configured.
 */
export function draftStoredSeo(product: ProductSeoInput): {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  socialImageAlt: string;
} {
  return {
    metaTitle: draftTitle(product),
    metaDescription: draftDescription(product),
    metaKeywords: draftKeywords(product).join(", "),
    socialImageAlt: draftImageAlt(product),
  };
}
