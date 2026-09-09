"use client";

import { useEffect, useState, type ReactNode } from "react";
import { locations, type Location } from "@/data/locations";
import { brand } from "@/data/brand";
import { storeUrl } from "@/lib/otter";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";
import { googleDirections, appleDirections, prefersAppleMaps } from "@/lib/directions";
import { OpenStatus } from "@/components/shared/OpenStatus";
import { storeStatus, statusLabel } from "@/lib/hours";

type LocationId = Location["id"];
const TWO_MILES = 3.2187 * pxPerKm;

/**
 * Map plus store cards, as in the prototype: pick a pin or a card and the other
 * follows. `mapCanvas` is the static geometry, built by a Server Component so
 * its path data never enters a client bundle.
 */
export function LocationsView({ mapCanvas }: { mapCanvas: ReactNode }) {
  const [sel, setSel] = useState<LocationId>("hollywood");
  const [apple, setApple] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setApple(prefersAppleMaps()), []);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const selected = locations.find((l) => l.id === sel) ?? locations[0];
  const calloutState = !selected.isOpen
    ? "Opening soon"
    : now
      ? statusLabel(storeStatus(selected, now))
      : "";

  return (
    <div className="cne-locs">
      <div className="cne-mapwrap">
        <div style={{ position: "relative", width: "100%" }}>
          {mapCanvas}
          <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={overlay}>
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
                className={[
                  "cne-map-pin",
                  loc.id === sel ? "is-selected" : "",
                  loc.isOpen ? "" : "is-soon",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <circle className="ring" r={9} />
                <circle className="head" r={6.4} />
                <text className="cap" y={-13} textAnchor="middle">
                  {loc.name.toUpperCase()}
                </text>
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
          {calloutState && (
            <div
              className="cne-callout"
              style={{
                left: `${(projectX(selected.lng) / mapBox.w) * 100}%`,
                top: `${(projectY(selected.lat) / mapBox.h) * 100}%`,
              }}
            >
              {selected.name.toUpperCase()}
              <small>{calloutState}</small>
            </div>
          )}
        </div>
      </div>

      <div className="cne-locs-list cne-sec">
        <div className="cne-eyebrow">Three counters</div>
        <h2>Find us.</h2>
        {locations.map((loc) => (
          <div
            key={loc.id}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h3>{loc.name.toUpperCase()}</h3>
              {loc.isOpen ? (
                <OpenStatus locationId={loc.id} />
              ) : (
                <span className="cne-stat is-shut">
                  <span className="cne-dot" aria-hidden="true" />
                  COMING SOON
                </span>
              )}
            </div>
            <div className="cne-loc-addr">
              {loc.address}
              <br />
              {loc.city}, {loc.region} {loc.postal}
            </div>

            {loc.isOpen ? (
              <>
                <div className="cne-loc-hrs">
                  {loc.hours.map(([day, hrs]) => (
                    <div className="r" key={day}>
                      <span>{day.toUpperCase()}</span>
                      <b>{hrs}</b>
                    </div>
                  ))}
                </div>
                {loc.sub && <div className="cne-loc-note">{loc.sub}</div>}
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
                {loc.id !== "hollywood" && (
                  <div className="cne-loc-note">
                    Online ordering for this store isn&rsquo;t live on Otter yet.
                  </div>
                )}
              </>
            ) : (
              <div className="cne-loc-note">Opening date to be announced.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const overlay = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};
