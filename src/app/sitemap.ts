import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { allLocationSlugs } from "@/lib/locationSlug";

export const dynamic = "force-static";

/**
 * Priority reflects how much of the business each page carries, not a wish:
 * the menu is what people search for and order from, so it sits alongside the
 * home page; the per-store pages are the local-search entry points.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1.0 },
    { path: "/menu/", priority: 0.9 },
    { path: "/order/", priority: 0.9 },
    { path: "/locations/", priority: 0.8 },
    ...allLocationSlugs().map((slug) => ({
      path: `/locations/${slug}/`,
      priority: 0.7,
    })),
    { path: "/about/", priority: 0.5 },
    { path: "/contact/", priority: 0.5 },
  ];

  return entries.map(({ path, priority }) => ({
    url: `${brand.siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  }));
}
