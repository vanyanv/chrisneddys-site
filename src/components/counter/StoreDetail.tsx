"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { locations, type Location } from "@/data/locations";
import { brand } from "@/data/brand";
import { storeUrl } from "@/lib/otter";
import { googleDirections, appleDirections, prefersAppleMaps } from "@/lib/directions";
import { slugFor, neighbourhoodFor } from "@/lib/locationSlug";
import { OpenStatus } from "@/components/shared/OpenStatus";

/**
 * One store's page. Beyond ranking for the neighbourhood, this is the page
 * someone lands on from a maps result, so it leads with the two things they
 * came for: whether it's open, and how to get there.
 *
 * The links to the other stores at the bottom are deliberate — a flat set of
 * location pages that only link up to the index gives search engines no signal
 * about how they relate.
 */
export function StoreDetail({
  loc,
  hood,
  fullAddress,
}: {
  loc: Location;
  hood: string;
  fullAddress: string;
}) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(prefersAppleMaps()), []);
  const others = locations.filter((l) => l.id !== loc.id);

  return (
    <>
      <section className="cne-sec">
        <div className="cne-eyebrow">{loc.isOpen ? "Open now" : "Opening soon"}</div>
        <h1>{hood}.</h1>

        <div className={`cne-loc ${loc.isOpen ? "is-live" : "is-soon"}`} style={{ marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <h2 style={{ font: "inherit", margin: 0, padding: 0 }}>{loc.name.toUpperCase()}</h2>
            {loc.isOpen ? (
              <OpenStatus locationId={loc.id} />
            ) : (
              <span className="cne-stat is-shut">
                <span className="cne-dot" aria-hidden="true" />
                COMING SOON
              </span>
            )}
          </div>

          <address className="cne-loc-addr" style={{ fontStyle: "normal" }}>
            {loc.address}
            <br />
            {loc.city}, {loc.region} {loc.postal}
          </address>

          {loc.isOpen && (
            <div className="cne-loc-hrs">
              {loc.hours.map(([day, hrs]) => (
                <div className="r" key={day}>
                  <span>{day.toUpperCase()}</span>
                  <b>{hrs}</b>
                </div>
              ))}
            </div>
          )}

          <div className="cne-loc-btns">
            {loc.id === "hollywood" && (
              <a className="cne-mini is-red" href={storeUrl} target="_blank" rel="noopener noreferrer">
                ORDER
              </a>
            )}
            <a
              className="cne-mini is-plain"
              href={apple ? appleDirections(loc) : googleDirections(loc)}
              target="_blank"
              rel="noopener noreferrer"
            >
              DIRECTIONS
            </a>
            <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
              CALL
            </a>
          </div>

          {loc.isOpen && loc.id !== "hollywood" && (
            <div className="cne-loc-note">
              Online ordering for this store isn&rsquo;t live on Otter yet.
            </div>
          )}
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">What we serve in {hood}</div>
        <h2>The same counter, the same menu.</h2>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
          Every Chris N Eddy&rsquo;s runs the same short menu: a slider is two smashed patties on
          two slices of cheese in a buttered, toasted Martin&rsquo;s potato roll. Order it
          Chris&rsquo;s Way with lettuce, tomato, sauce and raw onion, or Eddy&rsquo;s Way with
          sauce and grilled onion — every topping is free either way. Alongside them,
          chris-cut fries, cheese fries, loaded fries, shakes, and the Secret Menu.
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
        <h2>Our other counters.</h2>
        {others.map((o) => (
          <Link
            key={o.id}
            href={`/locations/${slugFor(o)}/`}
            className={`cne-loc ${o.isOpen ? "is-live" : "is-soon"}`}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <h3>{neighbourhoodFor(o).toUpperCase()}</h3>
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
