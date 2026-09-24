import { flagship, locations, type Location } from "@/data/locations";

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
 * The store a page is about: the one a `/locations/<slug>/` page is for, and
 * Hollywood, the store the site orders from, everywhere else.
 */
export function locationForPath(path: string): { loc: Location; onLocationPage: boolean } {
  const slug = /^\/locations\/([^/]+)\/?$/.exec(path)?.[1];
  const loc = slug ? locationBySlug(slug) : undefined;
  return loc ? { loc, onLocationPage: true } : { loc: flagship, onLocationPage: false };
}
