import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { menu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { itemOrderUrl } from "@/lib/otter";

/**
 * Emits Organization + one Restaurant node per location + the full Menu with
 * per-item prices. Critical for local search / Google Maps rich results; the
 * Menu node is what lets Google surface items and prices directly.
 */
export function JsonLd(): ReactElement {
  const menuId = `${brand.siteUrl}/menu/#menu`;

  const menuNode = {
    "@type": "Menu",
    "@id": menuId,
    name: `${brand.name} Menu`,
    url: `${brand.siteUrl}/menu/`,
    inLanguage: "en-US",
    hasMenuSection: (Object.keys(menu) as MenuCategoryKey[]).map((key) => ({
      "@type": "MenuSection",
      name: categoryTitles[key],
      hasMenuItem: menu[key].map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        description: item.desc || undefined,
        offers: {
          "@type": "Offer",
          price: item.price.toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: itemOrderUrl(item),
        },
      })),
    })),
  };

  const organization = {
    "@type": "Organization",
    "@id": `${brand.siteUrl}/#org`,
    name: brand.name,
    url: brand.siteUrl,
    logo: `${brand.siteUrl}/cne-logo.png`,
    sameAs: [brand.igUrl],
    foundingDate: String(brand.founded),
  };

  const restaurantImages = [
    `${brand.siteUrl}/photos/ig-pile.jpg`,
    `${brand.siteUrl}/photos/double.jpg`,
    `${brand.siteUrl}/photos/fries.jpg`,
  ];

  const restaurants = locations.map((loc) => ({
    "@type": "Restaurant",
    "@id": `${brand.siteUrl}/locations/#${loc.id}`,
    name: `${brand.name} — ${loc.name}`,
    url: `${brand.siteUrl}/locations/`,
    servesCuisine: ["American", "Fast Food", "Burgers"],
    priceRange: "$",
    image: restaurantImages,
    hasMenu: { "@id": menuId },
    telephone: brand.phone,
    email: brand.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: loc.address,
      addressLocality: loc.city,
      addressRegion: loc.region,
      postalCode: loc.postal || undefined,
      addressCountry: "US",
    },
    openingHoursSpecification:
      loc.openingSpec?.map((spec) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: spec.dayOfWeek,
        opens: spec.opens,
        closes: spec.closes,
      })) ?? undefined,
    isAccessibleForFree: false,
    acceptsReservations: false,
  }));

  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization, menuNode, ...restaurants],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
