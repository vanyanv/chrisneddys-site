import { brand } from "@/data/brand";
import { ID } from "@/lib/seo";
import { priceString } from "@/lib/otter";
import { type MerchProduct, type MerchView } from "@/data/merch";
import type { InventoryStatus } from "@/lib/catalog";
import { productMetadataName, productSocialImage, resolveProductSeo } from "@/lib/productSeo";

/**
 * Product structured data.
 *
 * This node carries only what is actually known about the product. That is a
 * deliberate trade, and it costs a rich result: Google draws a merchant listing
 * from `shippingDetails`, `hasMerchantReturnPolicy` and `availability`, and
 * none of the three can be stated yet — the shipping rate, the delivery window
 * and the returns window have not been decided, and the shop cannot take money.
 *
 * Fabricating them to win the listing would put a shipping price and a returns
 * promise into a search result that nobody at the store has agreed to
 * honour. It is also the exact shape of misrepresentation that earns a manual
 * action. So the node states the name, the price and the size, and stops.
 *
 * When the terms are real, add them back here and to `merch.ts` together — the
 * page and the snippet read from the same constants so they cannot drift.
 *
 * There is no `aggregateRating` and no `review`, because there are no reviews.
 */

/**
 * What Google is shown for the product.
 *
 * The photograph first, because a merchant listing wants the object and not a
 * poster of it; the share card second, since it is the 1200x630 that link
 * previews want and a second image costs nothing here. The card is the
 * owner's own `socialImageUrl` where one is set, and otherwise the per-product
 * card drawn at `shop/[product]/social-card` — never the hand-made
 * `/shop/<slug>.png`, which only exists for the seeded product. Preference
 * order for the photograph is the first gallery view's own shot, then the
 * legacy `product.photo` (Otter's asset, for a product built the old way),
 * then nothing — a product with neither falls back to the card alone.
 */
export function productImage(product: {
  slug: string;
  photo?: string;
  photoDir?: string;
  views?: MerchView[];
  socialImageUrl?: string | null;
}): string[] {
  const card = productSocialImage(product);
  const view = product.views?.[0];

  if (view?.photo) {
    return [`${brand.siteUrl}${product.photoDir ?? ""}/${view.photo.src}.webp`, card];
  }
  if (product.photo) {
    return [`${brand.siteUrl}/menu/${product.photo}.webp`, card];
  }
  return [card];
}

/**
 * A real store selling out is a fact worth stating even while the shop is
 * closed — a sold-out capsule with no way to buy it is not a
 * misrepresentation, it's the truth. Everything else here still follows
 * `shopOpen`: an in-stock claim on a shop that cannot take money would be.
 * `shopOpen` (`isShopOpenFor(settings)` — `src/lib/shopStatus.ts`) is passed
 * in rather than computed here: it needs the `store_settings` row, and
 * `productLd`'s callers (product pages) already fetch that row for their own
 * "Shipping & returns" line, so this stays a DB-free, unit-testable
 * composer, the same way `BagDrawer`'s `shopOpen` prop is read once
 * server-side and threaded down rather than re-derived per component.
 */
function offerAvailability(shopOpen: boolean, inventory?: InventoryStatus): string | undefined {
  if (inventory?.tracked) {
    if (inventory.available === 0) return "https://schema.org/SoldOut";
    if (shopOpen) return "https://schema.org/InStock";
    return undefined;
  }
  return shopOpen ? "https://schema.org/InStock" : undefined;
}

export function productLd(product: MerchProduct, inventory?: InventoryStatus, shopOpen = false) {
  const url = `${brand.siteUrl}/shop/${product.slug}/`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    // `product.name` is blank for anything created in the current admin and
    // `product.description` is likewise optional there, so both go through the
    // same resolvers the page's own `<head>` reads rather than a column that
    // can be empty.
    name: productMetadataName(product),
    // The product's own sentence where it has one, and only then the snippet
    // the page falls back to. A `description` here is not a search snippet and
    // has no 155-character budget to respect, so preferring the full sentence
    // over the shortened one is the right way round.
    description: product.description?.trim() || resolveProductSeo(product).description,
    image: productImage(product),
    url,
    sku: `CNE-${product.slug.toUpperCase()}`,
    brand: { "@type": "Brand", name: brand.name },
    manufacturer: { "@id": ID.org },
    size: product.oneSize ? "One size" : undefined,
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      url,
      priceCurrency: "USD",
      price: priceString(product.price),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ID.org },
      // Stated only once the shop can take money, unless the item has sold
      // out — see `offerAvailability`. Until then the price is a fact and the
      // ability to buy is not, so only the fact is published.
      availability: offerAvailability(shopOpen, inventory),
    },
  };
}

/** The shop index: an ItemList pointing at each product's own page. */
export function shopListLd(products: MerchProduct[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${brand.siteUrl}/shop/#list`,
    name: `${brand.name} Merch`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      // Same resolver as `productLd`, so a Rack-created product with a blank
      // `name` is not listed as an empty string.
      name: productMetadataName(p),
      url: `${brand.siteUrl}/shop/${p.slug}/`,
    })),
  };
}
