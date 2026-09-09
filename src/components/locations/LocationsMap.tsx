"use client";

import type { CSSProperties, ReactNode } from "react";
import { locations, type Location } from "@/data/locations";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";

type LocationId = Location["id"];

type Props = {
  selectedId: LocationId;
  onSelect: (id: LocationId) => void;
  /**
   * The static geometry, rendered by a Server Component and handed in so its
   * ~29 KB of path data never enters a client bundle.
   */
  canvas: ReactNode;
};

const TWO_MILES = 3.2187 * pxPerKm;

/**
 * The interactive half of the map: a transparent SVG laid over the geometry,
 * sharing its viewBox so a pin at (x, y) lands exactly where the projection
 * says it should.
 */
export function LocationsMap({ selectedId, onSelect, canvas }: Props) {
  const selected = locations.find((l) => l.id === selectedId);

  return (
    <div style={wrapStyle}>
      {canvas}

      <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={overlayStyle}>
        {/* Two miles around the selected store — the realistic pickup radius. */}
        {selected && selected.isOpen && (
          <circle
            cx={projectX(selected.lng)}
            cy={projectY(selected.lat)}
            r={TWO_MILES}
            className="cne-map-reach"
          />
        )}

        {locations.map((loc) => {
          const on = loc.id === selectedId;
          return (
            <g
              key={loc.id}
              transform={`translate(${projectX(loc.lng)},${projectY(loc.lat)})`}
              className={["cne-map-pin", on ? "is-selected" : "", loc.isOpen ? "" : "is-soon"]
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
                aria-hidden={false}
                aria-label={`${loc.name} — ${loc.status}`}
                aria-pressed={on}
                onClick={() => onSelect(loc.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(loc.id);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      <div className="cne-map-ribbon" style={ribbonStyle} aria-hidden="true">
        <span style={ribbonInnerStyle}>LOS ANGELES · CA</span>
      </div>
      <div className="cne-map-legend" style={legendStyle} aria-hidden="true">
        <div style={legendRow}>
          <span style={{ ...legendSwatch, background: "var(--color-cne-red)" }} />
          <span>OPEN</span>
        </div>
        <div style={legendRow}>
          <span style={{ ...legendSwatch, background: "var(--color-cne-yellow)" }} />
          <span>SOON</span>
        </div>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "relative",
  border: "4px solid var(--color-cne-ink)",
  boxShadow: "8px 8px 0 var(--color-cne-red)",
  background: "var(--color-cne-paper)",
  overflow: "hidden",
  isolation: "isolate",
  zIndex: 0,
};

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};

const ribbonStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: -10,
  zIndex: 2,
  transform: "rotate(-4deg)",
  pointerEvents: "none",
};

const ribbonInnerStyle: CSSProperties = {
  display: "inline-block",
  background: "var(--color-cne-ink)",
  color: "var(--color-cne-cream)",
  padding: "8px 18px",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  letterSpacing: 3,
  textTransform: "uppercase",
  border: "3px solid var(--color-cne-cream)",
  boxShadow: "4px 4px 0 var(--color-cne-red)",
};

const legendStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  right: 18,
  zIndex: 2,
  background: "var(--color-cne-cream)",
  border: "3px solid var(--color-cne-ink)",
  boxShadow: "4px 4px 0 var(--color-cne-ink)",
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: 1.5,
  fontWeight: 700,
  color: "var(--color-cne-ink)",
  pointerEvents: "none",
};

const legendRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

const legendSwatch: CSSProperties = {
  width: 14,
  height: 14,
  border: "2px solid var(--color-cne-ink)",
  display: "inline-block",
};
