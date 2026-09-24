"use client";

import { usePathname } from "next/navigation";
import type { Location } from "@/data/locations";
import { locationForPath } from "@/lib/locationSlug";

/**
 * The store the page in front of the visitor is about.
 *
 * On `/locations/<slug>/` that is the store the page is for; everywhere else
 * it is Hollywood, the store the site orders from. The header tag and the
 * bottom bar read this, so someone who lands on the Van Nuys page from a
 * search sees Van Nuys' opening, not Hollywood's hours and ORDER button.
 */
export function useViewedLocation(): { loc: Location; onLocationPage: boolean } {
  return locationForPath(usePathname() ?? "/");
}
