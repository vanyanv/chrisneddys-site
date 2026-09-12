import { brand } from "@/data/brand";
import { ID } from "@/lib/seo";
import { priceString } from "@/lib/otter";
import { SHOP_OPEN, type MerchProduct } from "@/data/merch";

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
 * The 1200x630 link preview. Always the generated card, never the photograph:
 * a product shot letterboxed into a social slot is a small object in a wide
 * grey field, and the card is built to that ratio on purpose.
 */
export function socialCard(slug: string): string {
  return `${brand.siteUrl}/shop/${slug}.png`;
}

/**
 * What Google is shown for the product.
 *
 * The photograph first, because a merchant listing wants the object and not a
 * poster of it; the generated social card second, since it is the 1200x630 that
 * link previews want and a second image costs nothing here. Products without a
 * photo fall back to the card alone.
 */
export function productImage(product: { slug: string; photo?: string }): string[] {
  const card = socialCard(product.slug);
  return product.photo ? [`${brand.siteUrl}/menu/${product.photo}.webp`, card] : [card];
}

export function productLd(product: MerchProduct) {
  const url = `${brand.siteUrl}/shop/${product.slug}/`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
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
      // Stated only once the shop can take money. Until then the price is a
      // fact and the ability to buy is not, so only the fact is published.
      availability: SHOP_OPEN ? "https://schema.org/InStock" : undefined,
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
      name: p.name,
      url: `${brand.siteUrl}/shop/${p.slug}/`,
    })),
  };
}
