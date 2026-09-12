import type { Metadata } from "next";
import { LocationsView } from "@/components/counter/LocationsView";
import { LocationsMapCanvas } from "@/components/locations/LocationsMapCanvas";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { brand } from "@/data/brand";
import { locations, flagship } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { closingSummary } from "@/lib/hours";

const title = "Locations — Hollywood, Glendale & Van Nuys";
const description = `Chris N Eddy’s in Hollywood (5539 W. Sunset Blvd), open until ${closingSummary(flagship)}. Glendale and Van Nuys opening soon.`;

export const metadata: Metadata = pageMetadata({ title, description, path: "/locations/" });

/**
 * An ItemList of the store pages: it says, in one node, that this page is the
 * index for three landing pages rather than the destination itself.
 */
const storeList = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Chris N Eddy's locations",
  itemListElement: locations.map((loc, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${brand.name} \u2014 ${loc.neighbourhood}`,
    url: `${brand.siteUrl}/locations/${slugFor(loc)}/`,
  })),
};

export default function LocationsPage() {
  return (
    <>
      <JsonLdScript data={breadcrumbLd([{ name: "Locations", path: "/locations/" }])} />
      <JsonLdScript data={storeList} />
      <LocationsView mapCanvas={<LocationsMapCanvas eager />} />
    </>
  );
}
