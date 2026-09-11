import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { allLocationSlugs } from "@/lib/locationSlug";
import { menu, featuredItems, MENU_UPDATED, type MenuCategoryKey } from "@/data/menu";
import { merch, MERCH_UPDATED } from "@/data/merch";

export const dynamic = "force-static";

/**
 * `lastmod` used to be the build timestamp on every URL, which told a crawler
 * only that the site had been rebuilt — the one thing it can already see. Each
 * route now carries the date its own content last changed, so a price change on
 * /menu/ is a real signal to come back and the pages that did not change do not
 * pretend otherwise.
 *
 * Dates are parsed as UTC noon rather than midnight so that rendering them in
 * any timezone cannot roll the date back a day.
 */
const asDate = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

/** When the location set — addresses, hours, which locations are open — last moved. */
const LOCATIONS_UPDATED = "2026-09-09";
/** When the site's copy and structure last changed. */
const SITE_UPDATED = "2026-09-09";

/** The menu photography, so image search has a route in to the food. */
const menuImages = (Object.keys(menu) as MenuCategoryKey[])
  .flatMap((key) => menu[key])
  .filter((item) => item.photo)
  .map((item) => `${brand.siteUrl}/menu/${item.photo}.webp`);

/** Deduplicated: several items share a photograph. */
const uniqueMenuImages = Array.from(new Set(menuImages));

/**
 * Priority reflects how much of the business each page carries, not a wish:
 * the menu is what people search for and order from, so it sits alongside the
 * home page; the per-store pages are the local-search entry points.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: Array<{
    path: string;
    priority: number;
    updated: string;
    images?: string[];
  }> = [
    {
      path: "/",
      priority: 1.0,
      updated: SITE_UPDATED,
      images: [
        `${brand.siteUrl}/hero-still.webp`,
        `${brand.siteUrl}/photos/ig-pile.jpg`,
        `${brand.siteUrl}/photos/double.jpg`,
        `${brand.siteUrl}/photos/fries.jpg`,
      ],
    },
    { path: "/menu/", priority: 0.9, updated: MENU_UPDATED, images: uniqueMenuImages },
    // The named-item landing pages. Below /menu/ itself, which is still the
    // page that should rank for "menu" and carries all 31 items.
    ...featuredItems.map((i) => ({
      path: `/menu/${i.id}/`,
      priority: 0.6,
      updated: MENU_UPDATED,
      images: i.photo ? [`${brand.siteUrl}/menu/${i.photo}.webp`] : undefined,
    })),
    { path: "/order/", priority: 0.9, updated: SITE_UPDATED },
    // The shop is its own funnel: /shop/ is the entry point and each product
    // page is what a search for the product itself should land on, so the
    // product ranks above the index it sits in.
    { path: "/shop/", priority: 0.7, updated: MERCH_UPDATED },
    ...merch.map((p) => ({
      path: `/shop/${p.slug}/`,
      priority: 0.8,
      updated: MERCH_UPDATED,
      images: [`${brand.siteUrl}/shop/${p.slug}.png`],
    })),
    { path: "/locations/", priority: 0.8, updated: LOCATIONS_UPDATED },
    ...allLocationSlugs().map((slug) => ({
      path: `/locations/${slug}/`,
      priority: 0.7,
      updated: LOCATIONS_UPDATED,
    })),
    { path: "/about/", priority: 0.5, updated: SITE_UPDATED },
    { path: "/contact/", priority: 0.5, updated: SITE_UPDATED },
  ];

  return entries.map(({ path, priority, updated, images }) => ({
    url: `${brand.siteUrl}${path}`,
    lastModified: asDate(updated),
    changeFrequency: "monthly",
    priority,
    ...(images && images.length ? { images } : {}),
  }));
}
