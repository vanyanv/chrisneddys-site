import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { menu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { itemOrderUrl, storeUrl } from "@/lib/otter";
import { slugFor, neighbourhoodFor } from "@/lib/locationSlug";
import { ID } from "@/lib/seo";

/** One `<script type="application/ld+json">`, escaped the way Next does it. */
export function JsonLdScript({ data }: { data: object }): ReactElement {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const RESTAURANT_IMAGES = [
  `${brand.siteUrl}/photos/ig-pile.jpg`,
  `${brand.siteUrl}/photos/double.jpg`,
  `${brand.siteUrl}/photos/fries.jpg`,
];

/**
 * The full Menu, with every item and price.
 *
 * Emitted only by /menu/, which is the page it describes and the only page
 * whose HTML it is worth 13 KB of. Everywhere else the Restaurant nodes point
 * at the stub below, so `hasMenu` still resolves inside the page's own graph.
 */
export function menuNode() {
  return {
    "@type": "Menu",
    "@id": ID.menu,
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
}

const menuStub = {
  "@type": "Menu",
  "@id": ID.menu,
  name: `${brand.name} Menu`,
  url: `${brand.siteUrl}/menu/`,
};

/**
 * The sitewide graph: who we are, what the site is, and where the counters are.
 *
 * `WebSite` is what Google reads for the site name it prints above a result,
 * and `Organization.logo` for the favicon beside it — neither is inferred from
 * the page, so both are stated. The Restaurant nodes carry each store's own
 * page as their `@id` and `url`, which is what ties a maps result to a landing
 * page rather than to the home page.
 */
export function JsonLd(): ReactElement {
  const flagship = locations.find((l) => l.id === "hollywood") ?? locations[0];

  const organization = {
    "@type": "Organization",
    "@id": ID.org,
    name: brand.name,
    alternateName: ["Chris N Eddys", "Chris and Eddy's", "Chris N Eddy's Burgers"],
    url: brand.siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${brand.siteUrl}/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: RESTAURANT_IMAGES,
    description:
      "Smash burger sliders from a Hollywood counter — two patties, two slices of cheese, a buttered Martin's potato roll, every topping free.",
    slogan: brand.tagline,
    sameAs: [brand.igUrl, storeUrl],
    foundingDate: String(brand.founded),
    telephone: brand.phone,
    email: brand.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: flagship.address,
      addressLocality: flagship.city,
      addressRegion: flagship.region,
      postalCode: flagship.postal,
      addressCountry: "US",
    },
    areaServed: locations.map((loc) => ({
      "@type": "City",
      name: neighbourhoodFor(loc),
    })),
  };

  const website = {
    "@type": "WebSite",
    "@id": ID.website,
    url: brand.siteUrl,
    name: brand.name,
    alternateName: "Chris N Eddys",
    description:
      "Smash burger sliders in Los Angeles — menu, prices, hours, locations and online ordering.",
    inLanguage: "en-US",
    publisher: { "@id": ID.org },
  };

  const restaurants = locations.map((loc) => ({
    "@type": "Restaurant",
    // The store's own page is the canonical home for this node, so both
    // carry the same @id and the same url. Two nodes sharing an @id but
    // disagreeing on url is a conflict, not a cross-reference.
    "@id": `${brand.siteUrl}/locations/${slugFor(loc)}/#restaurant`,
    name: `${brand.name} — ${loc.name}`,
    url: `${brand.siteUrl}/locations/${slugFor(loc)}/`,
    parentOrganization: { "@id": ID.org },
    servesCuisine: ["American", "Fast Food", "Burgers"],
    priceRange: "$",
    currenciesAccepted: "USD",
    paymentAccepted: "Cash, Credit Card, Debit Card, Apple Pay",
    image: RESTAURANT_IMAGES,
    hasMenu: { "@id": ID.menu },
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
    geo: { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${brand.name}, ${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim(),
    )}`,
    openingHoursSpecification:
      loc.openingSpec?.map((spec) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: spec.dayOfWeek,
        opens: spec.opens,
        closes: spec.closes,
      })) ?? undefined,
    // Only Hollywood has a live storefront; claiming an order action for a
    // counter that has not opened would send searchers to a dead end.
    potentialAction:
      loc.id === "hollywood"
        ? {
            "@type": "OrderAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: storeUrl,
              actionPlatform: [
                "http://schema.org/DesktopWebPlatform",
                "http://schema.org/MobileWebPlatform",
              ],
            },
            deliveryMethod: "http://purl.org/goodrelations/v1#DirectPickup",
          }
        : undefined,
    isAccessibleForFree: false,
    acceptsReservations: false,
  }));

  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@graph": [organization, website, menuStub, ...restaurants],
      }}
    />
  );
}
