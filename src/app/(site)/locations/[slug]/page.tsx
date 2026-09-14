import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { closingSummary } from "@/lib/hours";
import { JsonLdScript, restaurantLd } from "@/components/shared/JsonLd";
import { allLocationSlugs, locationBySlug } from "@/lib/locationSlug";
import { StoreDetail } from "@/components/counter/StoreDetail";
import { OpeningNotify } from "@/components/locations/OpeningNotify";

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
    : `Chris N Eddy’s is coming to ${hood} at ${loc.address}: the same smashed sliders, chris-cut fries and Secret Menu we serve at our Hollywood location.`;

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
      <nav className="cne-sec" aria-label="Breadcrumb" style={{ paddingBottom: 0 }}>
        <div className="cne-eyebrow">
          <Link href="/locations/" style={{ color: "inherit" }}>
            Locations
          </Link>{" "}
          / {hood}
        </div>
      </nav>
      <StoreDetail loc={loc} hood={hood} />
      {!loc.isOpen && (
        <section className="cne-sec cne-rv">
          <div className="cne-eyebrow">Not open yet</div>
          <h2>First to know.</h2>
          <p className="cne-lede">
            The {hood} location is being built. We do not have a date to give you yet, and we would
            rather say that than invent one — leave an email and you will hear from us the day it
            starts serving.
          </p>
          <OpeningNotify hood={hood} />
        </section>
      )}
      {loc.isOpen && (
        <section className="cne-sec cne-rv">
          <div className="cne-eyebrow">After everyone else has closed</div>
          <h2>Open late.</h2>
          <p className="cne-lede">
            We serve until {closingSummary(loc)}. Most places around {hood} are dark by ten, which
            is why so much of what we smash goes out after midnight — to people coming off a shift,
            out of a show on Sunset, or off the 101 with nowhere else still cooking.
          </p>
          <p className="cne-lede">
            The full menu runs the whole time. Nothing is pulled at midnight, and the fries are cut
            the same right up to close — {closingSummary(loc)} — as they are at noon.
          </p>
        </section>
      )}
    </>
  );
}
