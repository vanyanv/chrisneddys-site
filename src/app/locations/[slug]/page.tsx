import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brand } from "@/data/brand";
import { breadcrumbLd, openGraphFor, twitterFor } from "@/lib/seo";
import { JsonLdScript } from "@/components/shared/JsonLd";
import {
  allLocationSlugs,
  locationBySlug,
  neighbourhoodFor,
} from "@/lib/locationSlug";
import { StoreDetail } from "@/components/counter/StoreDetail";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allLocationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const loc = locationBySlug(slug);
  if (!loc) return {};

  const hood = neighbourhoodFor(loc);
  const title = `${hood} Smash Burgers & Sliders`;
  const full = `${title} · ${brand.name}`;
  const description = loc.isOpen
    ? `Looking for the best burgers in ${hood}? Chris N Eddy’s is at ${loc.address} — smashed sliders and chris-cut fries, 10AM till 1AM weeknights, 2AM Fri–Sun.`
    : `Chris N Eddy’s is coming to ${hood} at ${loc.address}: the same smashed sliders, chris-cut fries and Secret Menu we serve at our Hollywood counter.`;

  return {
    title,
    description,
    alternates: { canonical: `/locations/${slug}/` },
    openGraph: openGraphFor({ title: full, description, path: `/locations/${slug}/` }),
    twitter: twitterFor({ title: full, description }),
  };
}

export default async function LocationPage({ params }: Params) {
  const { slug } = await params;
  const loc = locationBySlug(slug);
  if (!loc) notFound();

  const hood = neighbourhoodFor(loc);
  const fullAddress = `${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim();

  /**
   * Only the breadcrumb here. The Restaurant node for this store is emitted
   * once, by the sitewide JsonLd component, with this page's URL as its
   * canonical `url` — so this page doesn't restate it.
   */
  const jsonLd = breadcrumbLd([
    { name: "Locations", path: "/locations/" },
    { name: hood, path: `/locations/${slug}/` },
  ]);

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <nav className="cne-sec" aria-label="Breadcrumb" style={{ paddingBottom: 0 }}>
        <div className="cne-eyebrow">
          <Link href="/locations/" style={{ color: "inherit" }}>
            Locations
          </Link>{" "}
          / {hood}
        </div>
      </nav>
      <StoreDetail loc={loc} hood={hood} fullAddress={fullAddress} />
    </>
  );
}
