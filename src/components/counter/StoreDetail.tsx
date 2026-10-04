import Link from "next/link";
import "@/styles/location-page.css";
import { locations, type Location } from "@/data/locations";
import { withUtm } from "@/lib/otter";
import { slugFor } from "@/lib/locationSlug";
import { OpenStatus, ComingSoonTag } from "@/components/shared/OpenStatus";
import { LiveOpenLabel } from "@/components/shared/LiveOpenLabel";
import { AddressLink, DirectionsLink } from "@/components/locations/DirectionsLink";
import { OpeningNotify } from "@/components/locations/OpeningNotify";
import { locationMonster } from "@/components/locations/locationArt";
import { Monster } from "@/components/mascots/Monster";
import { OpenLateNight } from "@/components/counter/OpenLateNight";
import { Tunnel } from "@/components/storeart/Tunnel";
import { OpStamp } from "@/components/storeart/SectionOpener";
import { ArtPhoto } from "@/components/art/ArtPhoto";
import { STORE_ART } from "@/data/storeArt";
import { SoundWave } from "@/components/locations/SoundWave";

function HoursBox({ loc }: { loc: Location }) {
  return (
    <dl className="cne-lp-hrs">
      {loc.hours.map(([day, hrs]) => (
        <div key={day}>
          <dt>{day}</dt>
          <dd>{hrs}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One store's page. Beyond ranking for the neighbourhood, this is the page
 * someone lands on from a maps result, so it leads with the two things they
 * came for: whether it's open, and how to get there. The hero is the store's
 * sign: status, name, address, hours and the one button, on the brand red,
 * with the room itself (or, before a store has one, the mural's tunnel) beside
 * it across the checkerboard floor seam the home page hero uses.
 *
 * The links to the other stores at the bottom are deliberate — a flat set of
 * location pages that only link up to the index gives search engines no signal
 * about how they relate.
 */
export function StoreDetail({ loc, hood }: { loc: Location; hood: string }) {
  const others = locations.filter((l) => l.id !== loc.id);
  const mon = locationMonster(loc.id);
  const art = STORE_ART[loc.id];

  return (
    <>
      <section className="cne-lp-hero" aria-labelledby="lp-h1">
        {/* Labelled for analytics like every other button group, so this
            page's address, ORDER, directions and CALL report the store and
            where the tap came from (src/components/shared/TrackEvents.tsx). */}
        <div className="cne-lp-panel" data-surface="location-page" data-location={slugFor(loc)}>
          <nav className="cne-lp-crumb" aria-label="Breadcrumb">
            <Link prefetch={false} href="/locations/">
              Locations
            </Link>{" "}
            / {hood}
          </nav>
          <p className="cne-lp-eyebrow">
            {loc.isOpen ? <LiveOpenLabel locationId={loc.id} /> : "Opening soon"}
          </p>
          <h1 id="lp-h1">{hood}.</h1>

          <div className="cne-lp-facts">
            <address className="cne-lp-addr">
              <AddressLink loc={loc} />
            </address>
            <div className="cne-lp-tag">
              {loc.isOpen ? <OpenStatus locationId={loc.id} /> : <ComingSoonTag />}
            </div>
          </div>

          {/* A store that has not opened has only a "Date to be announced"
              placeholder in `hours`, so it shows none. */}
          {loc.isOpen && <HoursBox loc={loc} />}

          <div className="cne-lp-btns">
            {loc.isOpen && loc.orderUrl && (
              <a
                className="cne-big is-primary"
                href={withUtm(loc.orderUrl, "location-page")}
                target="_blank"
                rel="noopener noreferrer"
              >
                ORDER ONLINE &rarr;
              </a>
            )}
            {!loc.isOpen && (
              <a className="cne-big is-primary" href="#notify">
                TELL ME WHEN IT OPENS
              </a>
            )}
            <div className="cne-lp-minis">
              <DirectionsLink loc={loc} className="cne-mini is-plain" />
              {loc.phoneTel && (
                <a className="cne-mini is-plain" href={`tel:${loc.phoneTel}`}>
                  CALL
                </a>
              )}
            </div>
          </div>
          {loc.isOpen && !loc.orderUrl && (
            <p className="cne-lp-note">
              Online ordering for this store isn&rsquo;t live on Otter yet.
            </p>
          )}
        </div>

        <div className="cne-lp-seam" aria-hidden="true" />

        <div className="cne-lp-media">
          {art ? (
            <>
              <ArtPhoto
                name={art.room.name}
                widths={[480, 720, 960]}
                phoneWidths={[480, 720]}
                width={720}
                height={540}
                sizes="(min-width: 901px) 52vw, 100vw"
                alt={art.room.alt}
                priority
              />
              <Monster
                species="classic"
                bodyColor={mon.body}
                irisColor={mon.iris}
                size={78}
                className="cne-lp-peek"
              />
            </>
          ) : (
            <Tunnel body={mon.body} iris={mon.iris} asleep={!loc.isOpen} />
          )}
        </div>
      </section>

      {loc.id === "vannuys" && <SoundWave />}

      {art && (
        <section className="cne-sec cne-locd cne-lp-walls cne-rv" aria-labelledby="lp-walls">
          <div className="cne-eyebrow">Art by {art.artist}</div>
          <h2 id="lp-walls">The walls.</h2>
          <ul className="cne-lp-murals">
            {art.walls.map((m) => (
              <li key={m.name}>
                <ArtPhoto
                  name={m.name}
                  widths={[360, 540]}
                  width={360}
                  height={480}
                  sizes="(min-width: 901px) 360px, 62vw"
                  alt={m.alt}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loc.isOpen && (
        <section
          id="notify"
          className="cne-sec cne-locd cne-rv"
          // Every "TELL ME WHEN IT OPENS" link (issue #108) on a coming-soon
          // card — /order/, /locations/, and this page's own hero — points
          // here. `html`'s sitewide `scroll-padding-top` (counter.css)
          // already clears the sticky header for any in-page anchor; this
          // just says so explicitly on the element itself, the same belt-
          // and-suspenders `legal.css` uses for its own jumped-to headings.
          style={{ scrollMarginTop: "var(--cne-stuck)" }}
        >
          <div className="cne-lp-notify">
            <Monster
              species="classic-sleep"
              bodyColor={mon.body}
              irisColor={mon.iris}
              size={64}
              className="cne-lp-notify-mon"
            />
            <div className="cne-eyebrow">Not open yet</div>
            <h2>First to know.</h2>
            <p className="cne-lede">
              {`The ${hood} location is being built. We do not have a date to give you yet, and we would rather say that than invent one — leave an email and you will hear from us the day it starts serving.`}
            </p>
            <OpeningNotify hood={hood} />
          </div>
        </section>
      )}

      {loc.isOpen && <OpenLateNight loc={loc} hood={hood} />}

      <section className="cne-sec cne-locd cne-lp-menu cne-rv cne-op-stamp">
        <div className="cne-eyebrow">What we serve in {hood}</div>
        <h2>
          Same menu everywhere.
          <OpStamp kind="checker" size={44} />
        </h2>
        <p className="cne-lp-prose">
          Every Chris N Eddy&rsquo;s runs the same short menu: a slider is two smashed patties on
          two slices of cheese in a buttered, toasted Martin&rsquo;s potato roll. Order it
          Chris&rsquo;s Way with lettuce, tomato, sauce and raw onion, or Eddy&rsquo;s Way with
          sauce and grilled onion. Alongside them, a side of fries, cheese fries, loaded fries,
          shakes, and the Secret Menu.
        </p>
        <div className="cne-loc-btns cne-lp-menu-btns">
          <Link prefetch={false} className="cne-mini is-red" href="/menu/">
            SEE THE MENU
          </Link>
          <Link prefetch={false} className="cne-mini is-plain" href="/order/">
            ORDER ONLINE
          </Link>
          <Link prefetch={false} className="cne-mini is-plain" href="/locations/">
            ALL LOCATIONS
          </Link>
        </div>
      </section>

      <section className="cne-sec cne-locd cne-rv cne-op-tag" style={{ paddingBottom: 30 }}>
        <div className="cne-eyebrow">Also nearby</div>
        <h2>Our other locations.</h2>
        <div className="cne-lp-others">
          {others.map((o) => {
            const om = locationMonster(o.id);
            return (
              <Link
                prefetch={false}
                key={o.id}
                href={`/locations/${slugFor(o)}/`}
                className={`cne-loc cne-lp-other ${o.isOpen ? "is-live" : "is-soon"}`}
              >
                <Monster
                  species={o.isOpen ? "classic" : "classic-sleep"}
                  bodyColor={om.body}
                  irisColor={om.iris}
                  size={52}
                  className="cne-lp-other-mon"
                />
                <div className="cne-lp-other-txt">
                  <h3>{o.neighbourhood.toUpperCase()}</h3>
                  <div className="cne-loc-addr">
                    {o.address}
                    <br />
                    {o.city}, {o.region}
                  </div>
                  <div className="cne-loc-note">
                    {o.isOpen ? <LiveOpenLabel locationId={o.id} suffix=" →" /> : "Opening soon →"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
