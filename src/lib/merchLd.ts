import { brand } from "@/data/brand";
import { ID } from "@/lib/seo";
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
 * promise into a search result that nobody behind the counter has agreed to
 * honour. It is also the exact shape of misrepresentation that earns a manual
 * action. So the node states the name, the price and the size, and stops.
 *
 * When the terms are real, add them back here and to `merch.ts` together — the
 * page and the snippet read from the same constants so they cannot drift.
 *
 * There is no `aggregateRating` and no `review`, because there are no reviews.
 */

/** The generated social card doubles as the product image until photography exists. */
export function productImage(slug: string): string {
  return `${brand.siteUrl}/shop/${slug}.png`;
}

export function productLd(product: MerchProduct) {
  const url = `${brand.siteUrl}/shop/${product.slug}/`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
    image: [productImage(product.slug)],
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
      price: product.price.toFixed(2),
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
