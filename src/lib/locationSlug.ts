import { locations, type Location } from "@/data/locations";

/**
 * Per-store URLs. A multi-location restaurant competes on "burgers in
 * <neighbourhood>", and one combined /locations page can only rank for one of
 * them — so each store gets an indexable page of its own.
 */
const SLUGS: Record<Location["id"], string> = {
  hollywood: "hollywood",
  glendale: "glendale",
  vannuys: "van-nuys",
};

export const slugFor = (loc: Location): string => SLUGS[loc.id];

export const locationBySlug = (slug: string): Location | undefined =>
  locations.find((l) => SLUGS[l.id] === slug);

export const allLocationSlugs = (): string[] => locations.map(slugFor);

/**
 * @deprecated The business rule now lives on the data: read `loc.neighbourhood`
 * directly. Kept only because `src/app/contact/page.tsx` — owned by another
 * worker in this pass — still imports it; every caller in this file's scope
 * has been switched to the field.
 */
export const neighbourhoodFor = (loc: Location): string => loc.neighbourhood;
