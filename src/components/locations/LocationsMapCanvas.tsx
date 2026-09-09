import { locations } from "@/data/locations";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";
import {
  motorwayPath,
  waterPath,
  riverPath,
  namedStreets,
  shields,
} from "@/data/laGeoPaths";

const TWO_MILES = 3.2187 * pxPerKm;

/** Store labels win; a street name never sits underneath one. */
const storeLabelAnchors = locations.map(
  (l) => [projectX(l.lng), projectY(l.lat) - 13] as const,
);

function labelIsClear(x: number, y: number): boolean {
  if (x < 12 || x > mapBox.w - 12 || y < 9 || y > mapBox.h - 20) return false;
  return !storeLabelAnchors.some(
    ([cx, cy]) => Math.abs(cx - x) < 34 && Math.abs(cy - y) < 9,
  );
}

/**
 * The static half of the map: real OpenStreetMap geometry drawn in brand
 * colours. A Server Component on purpose — the ~29 KB of path data ships once
 * in the HTML and never reaches a client bundle. The interactive pins are an
 * overlay in `LocationsMap`, sharing this viewBox so the coordinates line up.
 */
export function LocationsMapCanvas() {
  return (
    <svg
      viewBox={`0 0 ${mapBox.w} ${mapBox.h}`}
      role="img"
      aria-label="Map of Chris N Eddy's locations across Los Angeles, drawn from OpenStreetMap data"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <rect width={mapBox.w} height={mapBox.h} fill="var(--a-mapbg)" />

      <path d={waterPath} className="cne-map-water" />
      <path d={riverPath} className="cne-map-river" />

      {namedStreets.map((s) => (
        <path key={s.name} d={s.d} className="cne-map-blvd" />
      ))}

      {/* Freeways: black casing under brand yellow. Two real paths, not a
          <use> clone — <use> copies the source element's class along with its
          geometry, so the clone renders as casing and swallows the yellow.
          The duplicate costs ~0.7 KB gzipped; gzip dedupes the rest. */}
      <path d={motorwayPath} className="cne-map-fwy-case" />
      <path d={motorwayPath} className="cne-map-fwy" />

      {namedStreets.map((s) =>
        labelIsClear(s.label[0], s.label[1]) ? (
          <text
            key={`l-${s.name}`}
            className="cne-map-label"
            x={s.label[0]}
            y={s.label[1] - 2.6}
          >
            {s.name}
          </text>
        ) : null,
      )}

      {shields.map((s) => (
        <g key={s.ref} className="cne-map-shield" transform={`translate(${s.x},${s.y})`}>
          <rect x={-7.5} y={-5} width={15} height={10} rx={2.2} />
          <text y={2}>{s.ref}</text>
        </g>
      ))}

      {/* Scale bar, on its own plate so nothing reads through it. */}
      <g transform={`translate(12,${mapBox.h - 13})`}>
        <rect className="cne-map-plate" x={-6} y={-8} width={TWO_MILES + 30} height={16} rx={3} />
        <line x2={TWO_MILES} className="cne-map-rule" />
        <line y1={-2.6} y2={2.6} className="cne-map-rule" />
        <line x1={TWO_MILES} x2={TWO_MILES} y1={-2.6} y2={2.6} className="cne-map-rule" />
        <text className="cne-map-label" x={TWO_MILES + 4} y={2}>
          2 MI
        </text>
      </g>

      <g transform={`translate(${mapBox.w - 16},14)`}>
        <path d="M0,-8 L3.6,5 L0,2.6 L-3.6,5 Z" fill="var(--a-fg)" />
        <text className="cne-map-label" y={13} textAnchor="middle">
          N
        </text>
      </g>

      {/* ODbL requires this. Do not remove. */}
      <rect
        className="cne-map-plate"
        x={mapBox.w - 108}
        y={mapBox.h - 13}
        width={104}
        height={12}
        rx={3}
      />
      <text className="cne-map-attr" x={mapBox.w - 6} y={mapBox.h - 4} textAnchor="end">
        © OpenStreetMap contributors
      </text>
    </svg>
  );
}
