"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { locations, type Location } from "@/data/locations";
import { brand } from "@/data/brand";

const LocationsMap = dynamic(
  () => import("@/components/locations/LocationsMap").then((m) => m.LocationsMap),
  { ssr: false },
);

type LocationId = Location["id"];

function directionsUrl(loc: Location): string {
  const addr = encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.region}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
}

export function LocationSwitcher() {
  const [sel, setSel] = useState<LocationId>("hollywood");
  const loc = locations.find((l) => l.id === sel) ?? locations[0];

  return (
    <section
      aria-label="Locations"
      style={{ padding: "60px clamp(20px, 5vw, 60px)", maxWidth: 1280, margin: "0 auto" }}
    >
      <div
        className="cne-locations-grid"
        style={{ display: "grid", gap: 32, alignItems: "stretch" }}
      >
        <div className="cne-locations-map-col">
          <LocationsMap selectedId={sel} onSelect={setSel} />
        </div>
        <div
          className="cne-locations-side"
          style={{ display: "flex", flexDirection: "column", gap: 24 }}
        >
        <div
          className="cne-onscroll-stagger"
          role="tablist"
          aria-label="Pick a location"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {locations.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={sel === l.id}
              aria-controls="loc-panel"
              onClick={() => setSel(l.id)}
              className="cne-hover-lift"
              style={tabStyle(sel === l.id)}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  letterSpacing: 1,
                  lineHeight: 1,
                }}
              >
                {l.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  letterSpacing: 2,
                  color:
                    sel === l.id
                      ? "var(--color-cne-yellow)"
                      : "var(--color-cne-red)",
                  marginTop: 4,
                }}
              >
                {l.status.toUpperCase()}
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 14, marginTop: 8 }}>
                {l.address}
              </div>
            </button>
          ))}
        </div>

        <div
          key={sel}
          id="loc-panel"
          role="tabpanel"
          className="cne-reveal-scale"
          style={{
            border: "4px solid var(--color-cne-ink)",
            boxShadow: "8px 8px 0 var(--color-cne-red)",
            overflow: "hidden",
            background: "var(--color-cne-paper)",
          }}
        >
          <div style={{ padding: 28 }}>
            <address
              style={{
                fontStyle: "normal",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 3vw, 32px)",
                letterSpacing: 1,
                lineHeight: 1.1,
              }}
            >
              {loc.address}
            </address>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--color-cne-muted)",
                marginTop: 4,
              }}
            >
              {loc.city}, {loc.region} {loc.postal}
            </div>

            <dl
              style={{
                marginTop: 18,
                display: "grid",
                rowGap: 0,
              }}
            >
              {loc.hours.map(([day, hrs]) => (
                <div
                  key={day}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "2px dashed var(--color-cne-ink)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                  }}
                >
                  <dt style={{ fontWeight: 700 }}>{day}</dt>
                  <dd style={{ color: "var(--color-cne-muted)", margin: 0 }}>{hrs}</dd>
                </div>
              ))}
            </dl>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <a
                className="cne-hover-grow"
                href={directionsUrl(loc)}
                target="_blank"
                rel="noopener noreferrer"
                style={btn("red")}
              >
                Get directions →
              </a>
              <a
                className="cne-hover-grow"
                href={`tel:${brand.phoneTel}`}
                style={btn("yellow")}
              >
                Call us →
              </a>
            </div>
          </div>
        </div>
        </div>
      </div>
      <style>{`
        .cne-locations-grid { grid-template-columns: 1.15fr 1fr; }
        .cne-locations-map-col { min-height: 100%; }
        @media (max-width: 900px) {
          .cne-locations-grid { grid-template-columns: 1fr !important; }
          .cne-locations-map-col { min-height: 0; }
        }
      `}</style>
    </section>
  );
}

function tabStyle(active: boolean): CSSProperties {
  return {
    textAlign: "left",
    padding: 22,
    background: active ? "var(--color-cne-ink)" : "var(--color-cne-paper)",
    color: active ? "var(--color-cne-cream)" : "var(--color-cne-ink)",
    border: "4px solid var(--color-cne-ink)",
    cursor: "pointer",
    boxShadow: active ? "6px 6px 0 var(--color-cne-red)" : "6px 6px 0 var(--color-cne-ink)",
    fontFamily: "inherit",
  };
}

function btn(kind: "red" | "yellow"): CSSProperties {
  const isRed = kind === "red";
  return {
    background: isRed ? "var(--color-cne-red)" : "var(--color-cne-yellow)",
    color: isRed ? "var(--color-cne-cream)" : "var(--color-cne-ink)",
    padding: "12px 20px",
    fontFamily: "var(--font-display)",
    fontSize: 14,
    letterSpacing: 1.5,
    textDecoration: "none",
    border: "3px solid var(--color-cne-ink)",
    boxShadow: "4px 4px 0 var(--color-cne-ink)",
    textTransform: "uppercase",
  };
}
