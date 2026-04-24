import type { Metadata } from "next";
import { LocationsHero } from "@/components/locations/LocationsHero";
import { LocationSwitcher } from "@/components/locations/LocationSwitcher";

export const metadata: Metadata = {
  title: "Locations",
  description:
    "Chris N Eddy’s is open in Hollywood (5539 W. Sunset Blvd), with Glendale and Van Nuys opening Spring 2026.",
  alternates: { canonical: "/locations/" },
};

export default function LocationsPage() {
  return (
    <div style={{ background: "var(--color-cne-cream)", paddingBottom: 80 }}>
      <LocationsHero />
      <LocationSwitcher />
    </div>
  );
}
