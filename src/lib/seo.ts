import type { Metadata } from "next";
import { brand } from "@/data/brand";

/**
 * Search snippets have hard budgets: Google renders roughly the first 60
 * characters of a title and 155 of a description before truncating. Titles here
 * are written to fit *after* the `%s · Chris N Eddy's` template in layout.tsx.
 *
 * Each description leads with what the page is for and a concrete detail — a
 * price, an address, an hour — rather than adjectives, because that is what
 * makes a snippet worth clicking on a phone.
 */
export const OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: "A Chris N Eddy's double slider — two smashed patties and two slices of cheese on a buttered Martin's roll",
};

/** Stable @ids, so every page's graph points at the same three nodes. */
export const ID = {
  org: `${brand.siteUrl}/#org`,
  website: `${brand.siteUrl}/#website`,
  menu: `${brand.siteUrl}/menu/#menu`,
};

/** The 1200x630 shape `openGraphFor` and `twitterFor` want for a custom image. */
type OgImage = { url: string; width: number; height: number; alt: string };

/**
 * Page metadata declared per-page replaces the parent's `openGraph` wholesale,
 * which is why the sub-pages were shipping with no social image at all. This
 * builds the block so the image can't be forgotten again.
 */
export function openGraphFor(opts: {
  title: string;
  description: string;
  path: string;
  /** Defaults to the shared burger card — pass one when the page has its own. */
  image?: OgImage;
}) {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.path,
    siteName: brand.name,
    type: "website" as const,
    locale: "en_US",
    images: [opts.image ?? OG_IMAGE],
  };
}

export function twitterFor(opts: { title: string; description: string; image?: string }) {
  return {
    card: "summary_large_image" as const,
    title: opts.title,
    description: opts.description,
    images: [opts.image ?? OG_IMAGE.url],
  };
}

/**
 * The metadata block that most pages build: a title, a description, a
 * canonical, and the shared `openGraphFor`/`twitterFor` pair — both fed the
 * same `"<title> · <brand>"` line social previews want but a search snippet's
 * own `<title>` does not (that one gets it from the layout's title template
 * instead). Pass `image` for a page whose social card is its own subject
 * rather than the sitewide burger shot.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: OgImage;
}): Metadata {
  const full = `${opts.title} · ${brand.name}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: openGraphFor({
      title: full,
      description: opts.description,
      path: opts.path,
      image: opts.image,
    }),
    twitter: twitterFor({ title: full, description: opts.description, image: opts.image?.url }),
  };
}

/**
 * A BreadcrumbList for every page below the home page.
 *
 * Beyond the breadcrumb line Google draws in place of the URL, this is the
 * clearest statement a static site can make about its own hierarchy — which is
 * the same signal the sitelinks under a brand result are generated from. Home
 * is always position 1, so callers pass only what sits under it.
 */
export function breadcrumbLd(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${brand.siteUrl}${step.path}`,
    })),
  };
}
