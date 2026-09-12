import Link from "next/link";
import { locations, type Location } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { OpenStatus, ComingSoonTag } from "@/components/shared/OpenStatus";
import { LocationCard } from "@/components/locations/LocationCard";

/**
 * One store's page. Beyond ranking for the neighbourhood, this is the page
 * someone lands on from a maps result, so it leads with the two things they
 * came for: whether it's open, and how to get there.
 *
 * The links to the other stores at the bottom are deliberate — a flat set of
 * location pages that only link up to the index gives search engines no signal
 * about how they relate.
 */
export function StoreDetail({ loc, hood }: { loc: Location; hood: string }) {
  const others = locations.filter((l) => l.id !== loc.id);

  return (
    <>
      <section className="cne-sec">
        <div className="cne-eyebrow">{loc.isOpen ? "Open now" : "Opening soon"}</div>
        <h1>{hood}.</h1>

        <div
          className={`cne-loc ${loc.isOpen ? "is-live" : "is-soon"}`}
          style={{ marginTop: 14 }}
          data-surface="location-page"
          data-location={slugFor(loc)}
        >
          <LocationCard
            loc={loc}
            surface="location-page"
            // Not an `<h2>`: the page's own `<h1>` above already names this
            // store by neighbourhood, so a heading repeating it in caps is a
            // redundant node in the outline, not a second section.
            headingTag="p"
            headingClassName="cne-loc-h"
            headingStyle={{ font: "inherit", margin: 0, padding: 0 }}
            status={loc.isOpen ? <OpenStatus locationId={loc.id} /> : <ComingSoonTag />}
            addressAs="address"
            addressStyle={{ fontStyle: "normal" }}
            showButtonsWhenClosed
            footer={
              loc.isOpen &&
              !loc.otter && (
                <div className="cne-loc-note">
                  Online ordering for this store isn&rsquo;t live on Otter yet.
                </div>
              )
            }
          />
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">What we serve in {hood}</div>
        <h2>Same menu everywhere.</h2>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
          Every Chris N Eddy&rsquo;s runs the same short menu: a slider is two smashed patties on
          two slices of cheese in a buttered, toasted Martin&rsquo;s potato roll. Order it
          Chris&rsquo;s Way with lettuce, tomato, sauce and raw onion, or Eddy&rsquo;s Way with
          sauce and grilled onion — every topping is free either way. Alongside them, chris-cut
          fries, cheese fries, loaded fries, shakes, and the Secret Menu.
        </p>
        <div className="cne-loc-btns" style={{ maxWidth: 420, flexWrap: "wrap" }}>
          <Link className="cne-mini is-red" href="/menu/">
            SEE THE MENU
          </Link>
          <Link className="cne-mini is-plain" href="/order/">
            ORDER ONLINE
          </Link>
          <Link className="cne-mini is-plain" href="/locations/">
            ALL LOCATIONS
          </Link>
        </div>
      </section>

      <section className="cne-sec cne-rv" style={{ paddingBottom: 30 }}>
        <div className="cne-eyebrow">Also nearby</div>
        <h2>Our other locations.</h2>
        {others.map((o) => (
          <Link
            key={o.id}
            href={`/locations/${slugFor(o)}/`}
            className={`cne-loc ${o.isOpen ? "is-live" : "is-soon"}`}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <h3>{o.neighbourhood.toUpperCase()}</h3>
            <div className="cne-loc-addr">
              {o.address}
              <br />
              {o.city}, {o.region}
            </div>
            <div className="cne-loc-note">{o.isOpen ? "Open now →" : "Opening soon →"}</div>
          </Link>
        ))}
      </section>
    </>
  );
}
