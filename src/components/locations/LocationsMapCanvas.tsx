import { locations } from "@/data/locations";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";
import { namedStreets, shields } from "@/data/laGeoPaths";

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

/** The lettering layer sits over the geometry and under the pins. */
const lettering = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};

/**
 * The static half of the map: real OpenStreetMap geometry drawn in brand
 * colours.
 *
 * The geometry itself — water, river, boulevards, freeways — is ~94 KB of path
 * data that is identical on every page and every build, so it ships as
 * `public/map-base.svg` and is fetched once, cached, and shared by `/` and
 * `/locations/`. Inlined it cost ~130 KB *twice* per page: once in the HTML and
 * again in the RSC flight payload, because this component is a Server Component
 * rendered inside a client tree. Regenerate the file with
 * `node scripts/build-map-base.mjs` after touching `src/data/laGeoPaths.ts` or
 * the map colour tokens.
 *
 * The lettering stays inline: street names, freeway shields, the scale bar and
 * the ODbL attribution are drawn in the self-hosted mono face and coloured from
 * `--a-*` tokens, neither of which reach inside an `<img>`-loaded document.
 * It is a few hundred bytes and shares the base file's viewBox, as do the
 * interactive pins in `LocationsView` and `MapPins`, so everything lines up.
 *
 * Both call sites wrap this in a `position: relative` box, which is what the
 * absolutely positioned layers measure against.
 *
 * `eager` should be true only on /locations/, where the map is the page's own
 * subject and typically the largest thing above the fold; the home page's copy
 * is a smaller, secondary illustration further down the page and stays lazy.
 */
export function LocationsMapCanvas({ eager }: { eager?: boolean }) {
  return (
    <>
      <img
        src="/map-base.svg"
        alt="Map of Chris N Eddy's locations across Los Angeles, drawn from OpenStreetMap data"
        width={mapBox.w}
        height={mapBox.h}
        decoding="async"
        loading={eager ? undefined : "lazy"}
        style={{ display: "block", width: "100%", height: "auto" }}
      />

      <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={lettering}>
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
    </>
  );
}
