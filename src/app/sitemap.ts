import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { slugFor } from "@/lib/locationSlug";
import { locations } from "@/data/locations";
import { storeArtImages } from "@/data/storeArt";
import { menuPhotoLargest } from "@/lib/menuPhoto";
import {
  allPhotosFor,
  foodMenu,
  featuredItems,
  MENU_UPDATED,
  type MenuCategoryKey,
} from "@/data/menu";
import { PRIVACY_UPDATED } from "@/data/privacy";
import { catalogueUpdatedAt, listPublishedProducts } from "@/lib/catalog";
import { productSocialImage } from "@/lib/productSeo";

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
const LOCATIONS_UPDATED = "2026-09-30";
/**
 * When each page's own copy or structure last changed. Bump the one you touch:
 * a `lastmod` that trails the page tells a crawler there is nothing new to fetch.
 */
const HOME_UPDATED = "2026-09-24";
const ORDER_UPDATED = "2026-10-01";
const ABOUT_UPDATED = "2026-09-22";
const CONTACT_UPDATED = "2026-09-27";
/**
 * The /menu/ page's own layout and photos (the photo cards of issue #206,
 * the new combo and fries photos of issue #208, the drinks of issue #229, the
 * slider and straight-cut fries photos of issue #230), which can change
 * without the prices in `MENU_UPDATED` being re-reconciled.
 */
const MENU_PAGE_UPDATED = "2026-10-02";
const latest = (...isos: string[]): string => isos.sort().at(-1)!;
/** When /returns and /terms were added. Both also carry the store settings
 * row's own `updatedAt` as their JSON-LD `dateModified`, but the sitemap
 * itself only tracks changes to the route, not to the policy text. */
const RETURNS_TERMS_ADDED = "2026-09-14";
/** When /catering was added. */
const CATERING_UPDATED = "2026-10-01";
/** When /careers last changed (the store-art pass, issue #146). */
const CAREERS_UPDATED = "2026-09-24";

/** The menu photography, so image search has a route in to the food. */
const menuImages = (Object.keys(foodMenu) as MenuCategoryKey[])
  .flatMap((key) => foodMenu[key])
  .flatMap(allPhotosFor)
  .map((photo) => `${brand.siteUrl}${menuPhotoLargest(photo)}`);

/** Deduplicated: several items share a photograph. */
const uniqueMenuImages = Array.from(new Set(menuImages));

/**
 * Priority reflects how much of the business each page carries, not a wish:
 * the menu is what people search for and order from, so it sits alongside the
 * home page; the per-store pages are the local-search entry points.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [merch, merchUpdated] = await Promise.all([listPublishedProducts(), catalogueUpdatedAt()]);

  const entries: Array<{
    path: string;
    priority: number;
    updated: string;
    images?: string[];
  }> = [
    {
      path: "/",
      priority: 1.0,
      updated: HOME_UPDATED,
      // The files the page actually serves, which is what an image result has
      // to be able to fetch: the `.jpg` originals listed here before are only
      // ever referenced from structured data, and one of them (`fries.jpg`) is
      // not on the page at all. Every one of these carries alt text in `GRAM`.
      images: [
        `${brand.siteUrl}/hero-still.webp`,
        `${brand.siteUrl}/photos/ig-pile.webp`,
        `${brand.siteUrl}/photos/ig-neon.webp`,
        `${brand.siteUrl}/photos/ig-monster.webp`,
        `${brand.siteUrl}/photos/ig-pyramid.webp`,
        `${brand.siteUrl}/photos/ig-stack.webp`,
        `${brand.siteUrl}/photos/double.webp`,
      ],
    },
    {
      path: "/menu/",
      priority: 0.9,
      updated: latest(MENU_UPDATED, MENU_PAGE_UPDATED),
      images: uniqueMenuImages,
    },
    // The named-item landing pages. Below /menu/ itself, which is still the
    // page that should rank for "menu" and carries all 31 items.
    ...featuredItems.map((i) => ({
      path: `/menu/${i.id}/`,
      priority: 0.6,
      updated: latest(MENU_UPDATED, MENU_PAGE_UPDATED),
      images: i.photo
        ? allPhotosFor(i).map((photo) => `${brand.siteUrl}${menuPhotoLargest(photo)}`)
        : undefined,
    })),
    { path: "/order/", priority: 0.9, updated: ORDER_UPDATED },
    // The page a "catering" search should land on; catering is arranged
    // through the contact form, so it sits under /order/ rather than beside it.
    { path: "/catering/", priority: 0.7, updated: CATERING_UPDATED },
    // The shop is its own funnel: /shop/ is the entry point and each product
    // page is what a search for the product itself should land on, so the
    // product ranks above the index it sits in.
    { path: "/shop/", priority: 0.7, updated: merchUpdated },
    ...merch.map((p) => ({
      path: `/shop/${p.slug}/`,
      priority: 0.8,
      updated: merchUpdated,
      // The owner's own share image where one is set, otherwise the card
      // generated per product — never the hand-made `/shop/<slug>.png`,
      // which only exists for the seeded product.
      images: [productSocialImage(p)],
    })),
    { path: "/locations/", priority: 0.8, updated: LOCATIONS_UPDATED },
    // Each store's own photos (the room and its walls), from the page that
    // shows them. Glendale has none yet.
    ...locations.map((loc) => {
      const images = storeArtImages(loc.id).map((src) => `${brand.siteUrl}${src}`);
      return {
        path: `/locations/${slugFor(loc)}/`,
        priority: 0.7,
        updated: LOCATIONS_UPDATED,
        ...(images.length ? { images } : {}),
      };
    }),
    { path: "/about/", priority: 0.5, updated: ABOUT_UPDATED },
    { path: "/contact/", priority: 0.5, updated: CONTACT_UPDATED },
    // A page for people, not customers — never the answer to a search someone
    // orders from, so it sits with /about/ and /contact/ rather than up with
    // the menu or the shop.
    {
      path: "/careers/",
      priority: 0.4,
      updated: CAREERS_UPDATED,
      images: [`${brand.siteUrl}/photos/art/hollywood-wall-900.webp`],
    },
    // Listed, but at the floor: it is a page that has to be findable and is
    // never the answer to a search. Its own `lastmod` comes from the policy
    // itself, so a crawler is told the terms moved only when they did.
    { path: "/privacy/", priority: 0.1, updated: PRIVACY_UPDATED },
    { path: "/returns/", priority: 0.1, updated: RETURNS_TERMS_ADDED },
    { path: "/terms/", priority: 0.1, updated: RETURNS_TERMS_ADDED },
  ];

  return entries.map(({ path, priority, updated, images }) => ({
    url: `${brand.siteUrl}${path}`,
    lastModified: asDate(updated),
    changeFrequency: "monthly",
    priority,
    ...(images && images.length ? { images } : {}),
  }));
}
