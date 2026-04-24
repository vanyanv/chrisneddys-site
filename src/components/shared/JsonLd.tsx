import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";

/**
 * Emits Organization + one Restaurant node per location. Critical for
 * local search / Google Maps rich results.
 */
export function JsonLd(): ReactElement {
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
    hasMenu: `${brand.siteUrl}/menu/`,
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
    "@graph": [organization, ...restaurants],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
