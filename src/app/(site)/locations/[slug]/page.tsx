import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { closingSummary } from "@/lib/hours";
import { JsonLdScript, restaurantLd } from "@/components/shared/JsonLd";
import { allLocationSlugs, locationBySlug } from "@/lib/locationSlug";
import { StoreDetail } from "@/components/counter/StoreDetail";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allLocationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const loc = locationBySlug(slug);
  if (!loc) return {};

  const hood = loc.neighbourhood;
  // Late night is the one thing this location has that the Hollywood smashburger
  // field mostly does not — For The Win shuts at 9PM — so the open location says
  // so in its title rather than burying it in the hours table.
  const title = loc.isOpen ? `${hood} Smash Burgers, Open Late` : `${hood} Smash Burgers & Sliders`;
  const description = loc.isOpen
    ? `Chris N Eddy’s smash burger sliders in ${hood}, at ${loc.address}. Chris-cut fries, every topping free, open until ${closingSummary(loc)}.`
    : `Chris N Eddy’s is coming to ${hood} at ${loc.address}${
        loc.openingAnnouncement
          ? `, with its ${loc.openingAnnouncement.charAt(0).toLowerCase()}${loc.openingAnnouncement.slice(1)}`
          : ""
      }: the same smashed sliders, chris-cut fries and Secret Menu we serve in Hollywood.`;

  return pageMetadata({ title, description, path: `/locations/${slug}/` });
}

export default async function LocationPage({ params }: Params) {
  const { slug } = await params;
  const loc = locationBySlug(slug);
  if (!loc) notFound();

  const hood = loc.neighbourhood;

  const jsonLd = breadcrumbLd([
    { name: "Locations", path: "/locations/" },
    { name: hood, path: `/locations/${slug}/` },
  ]);

  return (
    <>
      <JsonLdScript data={jsonLd} />
      {/* The Restaurant node lives on the store's own page, and only once the
          store is serving. A node for an address with no hours, no phone and
          no way to order is a claim to local search that a business is open
          there — the same claim DEPLOY.md says not to make on a Google
          Business Profile until the doors do. The page's title, copy and
          visible address still say what is coming. */}
      {loc.isOpen && <JsonLdScript data={restaurantLd(loc)} />}
      <StoreDetail loc={loc} hood={hood} />
    </>
  );
}
