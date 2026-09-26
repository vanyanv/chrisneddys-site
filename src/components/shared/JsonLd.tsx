import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { locations, flagship, type Location } from "@/data/locations";
import { foodMenu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { itemOrderUrl, storeUrl, priceString } from "@/lib/otter";
import { slugFor } from "@/lib/locationSlug";
import { mapsQuery } from "@/lib/directions";
import { deliveryPlatforms, deliveryFor, cateringPlatform } from "@/data/delivery";
import { ID, siteDescription } from "@/lib/seo";

/** "+13235443600" -> "+1 323-544-3600", the form `brand.phoneIntl` uses. */
function intlPhone(tel: string | undefined): string | undefined {
  if (!tel || !/^\+1\d{10}$/.test(tel)) return tel;
  return `+1 ${tel.slice(2, 5)}-${tel.slice(5, 8)}-${tel.slice(8)}`;
}

/** One `<script type="application/ld+json">`, escaped the way Next does it. */
export function JsonLdScript({ data }: { data: object }): ReactElement {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/**
 * The same photograph in the three ratios Google asks a local business for —
 * 16:9, 4:3 and 1:1. The portrait originals are still what the pages use; a
 * crawler picking one of these for a result gets a frame it can actually place,
 * which a 900x1125 portrait is not.
 */
const RESTAURANT_IMAGES = [
  `${brand.siteUrl}/photos/double-16x9.jpg`,
  `${brand.siteUrl}/photos/double-4x3.jpg`,
  `${brand.siteUrl}/photos/double-1x1.jpg`,
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
    hasMenuSection: (Object.keys(foodMenu) as MenuCategoryKey[]).map((key) => ({
      "@type": "MenuSection",
      name: categoryTitles[key],
      hasMenuItem: foodMenu[key].map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        description: item.desc || undefined,
        offers: {
          "@type": "Offer",
          price: priceString(item.price),
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
 * One store, as a `Restaurant`.
 *
 * Emitted by the page whose subject the store is, not sitewide: a Restaurant
 * node is a claim that a business exists at an address, and repeating all three
 * on every page of the site made that claim about two locations that have not
 * opened, on pages that are not about them. The `@id` is unchanged, so anything
 * already pointing at it still resolves.
 *
 * `parentOrganization` resolves against the Organization node in the sitewide
 * graph, which every page still carries.
 */
export function restaurantNode(loc: Location) {
  return {
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
    // `hasMenu` points at the node; `menu` is the URL Google's food-establishment
    // documentation asks for, and the one a result can actually link to.
    menu: `${brand.siteUrl}/menu/`,
    // Only the location that answers it, and that location's own line. Three
    // addresses across two cities sharing one number is the pattern local
    // search treats as a virtual office.
    telephone: intlPhone(loc.phoneTel),
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
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(loc))}`,
    openingHoursSpecification:
      loc.openingSpec?.map((spec) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: spec.dayOfWeek,
        opens: spec.opens,
        closes: spec.closes,
      })) ?? undefined,
    // Only an open location gets order actions at all — claiming one for a
    // location that has not opened would send searchers to a dead end.
    // Pickup direct from the storefront, then each delivery platform that
    // carries the location. Listing them separately is what lets a result
    // offer "order delivery" as well as "order pickup"; before this the only
    // stated way to buy was pickup, which is not what most people want at 1AM.
    potentialAction:
      loc.isOpen && loc.orderUrl
        ? [
            {
              "@type": "OrderAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: loc.orderUrl,
                actionPlatform: [
                  "http://schema.org/DesktopWebPlatform",
                  "http://schema.org/MobileWebPlatform",
                ],
              },
              deliveryMethod: "http://purl.org/goodrelations/v1#DirectPickup",
            },
            ...deliveryFor(loc.id).map((platform) => ({
              "@type": "OrderAction",
              name: `Order delivery on ${platform.name}`,
              target: {
                "@type": "EntryPoint",
                urlTemplate: platform.url,
                actionPlatform: [
                  "http://schema.org/DesktopWebPlatform",
                  "http://schema.org/MobileWebPlatform",
                ],
              },
              deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
            })),
          ]
        : undefined,
    acceptsReservations: false,
  };
}

/** The same node, ready to be dropped into a page's own `<script>`. */
export function restaurantLd(loc: Location) {
  return { "@context": "https://schema.org", ...restaurantNode(loc) };
}

/**
 * The sitewide graph: who we are, what the site is, and where the locations are.
 *
 * `WebSite` is what Google reads for the site name it prints above a result,
 * and `Organization.logo` for the favicon beside it — neither is inferred from
 * the page, so both are stated. The per-store `Restaurant` nodes are not here:
 * see `restaurantNode`, which the pages that are about a store emit themselves.
 */
export function JsonLd(): ReactElement {
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
    description: siteDescription(),
    slogan: brand.tagline,
    // The listings that already carry the reviews, photos and menus search
    // engines use to reconcile "Chris N Eddy's" into one entity. Without these
    // the 699 reviews on Yelp and the delivery listings are evidence about a
    // business the graph has no way to know is this one.
    sameAs: [
      brand.igUrl,
      storeUrl,
      "https://www.yelp.com/biz/chris-n-eddy-s-los-angeles",
      "https://www.tripadvisor.com/Restaurant_Review-g32655-d27967767-Reviews-Chris_N_Eddy_s-Los_Angeles_California.html",
      ...deliveryPlatforms.map((p) => p.url),
      cateringPlatform.url,
    ],
    foundingDate: String(brand.founded),
    telephone: brand.phoneIntl,
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
      name: loc.neighbourhood,
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

  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@graph": [organization, website, menuStub],
      }}
    />
  );
}
