import type { Metadata } from "next";
import { LocationsView } from "@/components/counter/LocationsView";
import { LocationsMapCanvas } from "@/components/locations/LocationsMapCanvas";

const description =
  "Chris N Eddy’s smashed sliders in Hollywood (5539 Sunset Blvd) and Glendale (1360 E Colorado St), with Van Nuys opening soon. Hours, directions and online ordering.";

export const metadata: Metadata = {
  title: "Locations",
  description,
  alternates: { canonical: "/locations/" },
  openGraph: {
    title: "Locations · Chris N Eddy's",
    description,
    url: "/locations/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Locations · Chris N Eddy's",
    description,
  },
};

export default function LocationsPage() {
  return <LocationsView mapCanvas={<LocationsMapCanvas />} />;
}
