import { locations, type Location } from "@/data/locations";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";

export const TWO_MILES = 3.2187 * pxPerKm;

export const mapOverlayStyle = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};

/**
 * The drawn part of a pin — ring, head, and the store's name above it.
 *
 * Shared so the home page and /locations cannot drift apart: /locations wraps
 * this in a group that also carries the hit target and selection handlers,
 * while the home page draws it and nothing else.
 */
export function MapPinArt({ loc }: { loc: Location }) {
  return (
    <>
      <circle className="ring" r={9} />
      <circle className="head" r={6.4} />
      <text className="cap" y={-13} textAnchor="middle">
        {loc.name.toUpperCase()}
      </text>
    </>
  );
}

/** The class list a pin carries for its state, as in the prototype. */
export function pinClass(loc: Location, selectedId?: string): string {
  return ["cne-map-pin", loc.id === selectedId ? "is-selected" : "", loc.isOpen ? "" : "is-soon"]
    .filter(Boolean)
    .join(" ");
}

/**
 * A static pin layer for the home page's map, where the map is a picture rather
 * than a control: no hit targets, no selection, nothing to hydrate. The
 * geometry underneath is `LocationsMapCanvas`, and both share its viewBox so
 * the coordinates line up.
 */
export function MapPins({ selectedId = "hollywood" }: { selectedId?: string }) {
  const selected = locations.find((l) => l.id === selectedId);

  return (
    <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={mapOverlayStyle}>
      {selected?.isOpen && (
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
          className={pinClass(loc, selectedId)}
        >
          <MapPinArt loc={loc} />
        </g>
      ))}
    </svg>
  );
}
