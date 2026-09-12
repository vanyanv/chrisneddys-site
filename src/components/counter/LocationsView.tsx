"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { locations, flagship, type Location } from "@/data/locations";
import { mapBox, projectX, projectY } from "@/data/laGeo";
import { MapPinArt, pinClass, TWO_MILES, mapOverlayStyle } from "@/components/locations/MapPins";
import { MapCallout } from "@/components/locations/MapCallout";
import { OpenStatus, ComingSoonTag } from "@/components/shared/OpenStatus";
import { slugFor } from "@/lib/locationSlug";
import { LocationCard } from "@/components/locations/LocationCard";

type LocationId = Location["id"];

/**
 * Map plus store cards, as in the prototype: pick a pin or a card and the other
 * follows. `mapCanvas` is the static geometry, built by a Server Component so
 * its path data never enters a client bundle.
 */
export function LocationsView({ mapCanvas }: { mapCanvas: ReactNode }) {
  const [sel, setSel] = useState<LocationId>("hollywood");

  const selected = locations.find((l) => l.id === sel) ?? flagship;

  return (
    /* `data-surface` sits on the whole view, not on one button row: every
       outbound link below it — the map's own order link, DIRECTIONS, CALL —
       belongs to the same surface, and `orderUrl("locations-map")` already
       tags the Otter side the same way. */
    <div className="cne-locs" data-surface="locations-map">
      <div className="cne-mapwrap">
        <div style={{ position: "relative", width: "100%" }}>
          {mapCanvas}
          <svg
            viewBox={`0 0 ${mapBox.w} ${mapBox.h}`}
            role="group"
            aria-label="Pick a location on the map"
            style={mapOverlayStyle}
          >
            {selected.isOpen && (
              <circle
                cx={projectX(selected.lng)}
                cy={projectY(selected.lat)}
                r={TWO_MILES}
                className="cne-map-reach"
              />
            )}
            {locations.map((loc) => (
              <g
                key={loc.id}
                transform={`translate(${projectX(loc.lng)},${projectY(loc.lat)})`}
                className={pinClass(loc, sel)}
              >
                <MapPinArt loc={loc} />
                <circle
                  className="hit"
                  r={17}
                  role="button"
                  tabIndex={0}
                  aria-label={`${loc.name} — ${loc.status}`}
                  aria-pressed={loc.id === sel}
                  onClick={() => setSel(loc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSel(loc.id);
                    }
                  }}
                />
              </g>
            ))}
          </svg>
          <MapCallout locationId={sel} />
        </div>
      </div>

      <div className="cne-locs-list cne-sec">
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
                    {!loc.otter && (
                      <div className="cne-loc-note">
                        Online ordering for this store isn&rsquo;t live on Otter yet.
                      </div>
                    )}
                    <Link
                      href={`/locations/${slugFor(loc)}/`}
                      className="cne-loc-note cne-loc-more"
                    >
                      {loc.name} details &amp; directions &rarr;
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="cne-loc-note">Opening date to be announced.</div>
                    <Link
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
