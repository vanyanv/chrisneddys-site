"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { locations, type Location } from "@/data/locations";
import { mapBox, projectX, projectY } from "@/data/laGeo";
import { MapPinArt, pinClass, mapOverlayStyle } from "@/components/locations/MapPins";
import { MapCallout } from "@/components/locations/MapCallout";
import { PIN } from "@/components/locations/mapLayout";
import { OpenStatus, ComingSoonTag } from "@/components/shared/OpenStatus";
import { slugFor } from "@/lib/locationSlug";
import { LocationCard } from "@/components/locations/LocationCard";
import { GlyphRow } from "@/components/storeart/SectionOpener";

type LocationId = Location["id"];

/**
 * Map plus store cards, as in the prototype: pick a pin or a card and the other
 * follows. `mapCanvas` is the static geometry, built by a Server Component so
 * its path data never enters a client bundle.
 */
export function LocationsView({ mapCanvas }: { mapCanvas: ReactNode }) {
  const [sel, setSel] = useState<LocationId>("hollywood");

  /* Picking a pin on a phone changes a card that is usually below the fold,
     so without this the tap looks like it did nothing. Only scrolls when the
     card isn't already fully on screen between the sticky header and the
     order dock, so a desktop visitor with the list in view never moves. */
  const pickFromMap = (loc: Location) => {
    setSel(loc.id);
    const card = document.querySelector<HTMLElement>(`[data-location="${slugFor(loc)}"]`);
    if (!card) return;
    const r = card.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (r.top >= top && r.bottom <= window.innerHeight - 72) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  };

  return (
    /* `data-surface` sits on the whole view, not on one button row: every
       outbound link below it — the map's own order link, DIRECTIONS, CALL —
       belongs to the same surface, and `orderUrl("locations-map")` already
       tags the Otter side the same way. */
    <div className="cne-locs" data-surface="locations-map">
      <div className="cne-mapwrap">
        {/* `.cne-split-frame` / `.cne-split-map` are the home page map
            split's own classes (`counter.css`, "locations" region) — generic,
            not scoped to that page, and reused here so this map fills its
            desktop panel the same way: centred, with the roads fading into
            the panel's own colour over any spare room instead of leaving a
            flat empty strip. See `git show fb7b3bf`. `.cne-mapbox` keeps the
            whole map on screen on a phone held sideways. */}
        <div className="cne-split-frame">
          <div className="cne-split-map cne-mapbox">
            {mapCanvas}
            <svg
              viewBox={`0 0 ${mapBox.w} ${mapBox.h}`}
              role="group"
              aria-label="Pick a location on the map"
              style={mapOverlayStyle}
            >
              {locations.map((loc) => (
                <g
                  key={loc.id}
                  transform={`translate(${projectX(loc.lng)},${projectY(loc.lat)})`}
                  className={pinClass(loc, sel)}
                >
                  <MapPinArt loc={loc} />
                  <circle
                    className="hit"
                    cy={PIN.hitY}
                    r={PIN.hitR}
                    role="button"
                    tabIndex={0}
                    aria-label={`${loc.name} — ${loc.status}`}
                    aria-pressed={loc.id === sel}
                    onClick={() => pickFromMap(loc)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pickFromMap(loc);
                      }
                    }}
                  />
                </g>
              ))}
            </svg>
            <MapCallout locationId={sel} />
          </div>
        </div>
      </div>

      <div className="cne-locs-list cne-sec cne-op-glyph">
        <GlyphRow />
        <div className="cne-eyebrow">Three locations</div>
        <h1>Find us.</h1>
        {locations.map((loc) => (
          <div
            key={loc.id}
            data-location={slugFor(loc)}
            className={[
              "cne-loc",
              loc.isOpen ? "is-live" : "is-soon",
              loc.id === sel ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSel(loc.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              // Only a key pressed on the card itself selects it. Enter on a
              // link inside (ORDER, DIRECTIONS, CALL, details) bubbles up here,
              // and cancelling it would stop that link from opening.
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSel(loc.id);
              }
            }}
          >
            <LocationCard
              loc={loc}
              surface="locations-map"
              headingTag="h2"
              headingClassName="cne-loc-name"
              status={loc.isOpen ? <OpenStatus locationId={loc.id} /> : <ComingSoonTag />}
              footer={
                loc.isOpen ? (
                  <>
                    {!loc.orderUrl && (
                      <div className="cne-loc-note">
                        Online ordering for this store isn&rsquo;t live on Otter yet.
                      </div>
                    )}
                    <Link
                      prefetch={false}
                      href={`/locations/${slugFor(loc)}/`}
                      className="cne-loc-note cne-loc-more"
                    >
                      {loc.name} details &amp; directions &rarr;
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="cne-loc-note">
                      {loc.openingAnnouncement ?? "Opening date to be announced."}
                    </div>
                    <Link
                      prefetch={false}
                      href={`/locations/${slugFor(loc)}/`}
                      className="cne-loc-note cne-loc-more"
                    >
                      {loc.name} details &rarr;
                    </Link>
                  </>
                )
              }
            >
              {loc.sub && <div className="cne-loc-note">{loc.sub}</div>}
            </LocationCard>
          </div>
        ))}
      </div>
    </div>
  );
}
