import type { Metadata } from "next";
import { LocationsView } from "@/components/counter/LocationsView";
import { LocationsMapCanvas } from "@/components/locations/LocationsMapCanvas";
import { openGraphFor, twitterFor } from "@/lib/seo";

const title = "Locations — Hollywood, Glendale & Van Nuys";
const description =
  "Chris N Eddy’s in Hollywood (5539 Sunset Blvd) and Glendale (1360 E Colorado St), open till 1AM on weeknights and 2AM Friday to Sunday. Van Nuys opening soon.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/locations/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/locations/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

export default function LocationsPage() {
  return <LocationsView mapCanvas={<LocationsMapCanvas />} />;
}
