import type { CSSProperties } from "react";
import "@/styles/map-pins-art.css";
import { locations, type Location } from "@/data/locations";
import { mapBox, projectX, projectY } from "@/data/laGeo";
import { PIN, SOON_SUFFIX, capWidth } from "@/components/locations/mapLayout";
import { locationMonster } from "@/components/locations/locationArt";
import { monsterHref } from "@/components/mascots/Monster";

export const mapOverlayStyle = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
};

/** The custom properties `cne-classic`/`cne-classic-sleep` (`MascotDefs`) read. */
type PinStyle = CSSProperties & { "--m-body"?: string; "--m-iris"?: string };

/** Idea 9: each store's own colour, from `locationArt.ts`. */
function pinStyle(id: Location["id"]): PinStyle {
  const { body, iris } = locationMonster(id);
  return { "--m-body": body, "--m-iris": iris };
}

/**
 * The drawn part of a pin — a small classic monster head on a short black
 * point, plus the store's name above it on a paper plate, so a freeway
 * crossing behind the name can't cut through the letters. Asleep instead of
 * awake for a location that hasn't opened, same as a sold-out product (idea
 * 11's `cne-classic-sleep`), and its name carries a "· SOON" tail so that
 * reads at a glance too.
 *
 * Shared so the home page and /locations cannot drift apart: /locations wraps
 * this in a group that also carries the hit target and selection handlers,
 * while the home page draws it and nothing else. Every size here is the one
 * `mapLayout.ts` reserves room for.
 */
export function MapPinArt({ loc }: { loc: Location }) {
  const style = pinStyle(loc.id);
  const plateW = capWidth(loc) + PIN.platePadX * 2;
  return (
    <>
      <path className="cne-pin-point" d="M-5,-8 L0,0 L5,-8 Z" />
      <use
        href={loc.isOpen ? monsterHref(locationMonster(loc.id).body) : "#cne-classic-sleep"}
        className="cne-pin-mon"
        x={-12}
        y={PIN.headTop}
        width={24}
        height={24}
        style={style}
      />
      <rect
        className="cne-pin-plate"
        x={-plateW / 2}
        y={PIN.capY - 7.5}
        width={plateW}
        height={10}
        rx={2}
      />
      <text className="cap" y={PIN.capY} textAnchor="middle">
        {loc.name.toUpperCase()}
        {!loc.isOpen && <tspan className="cne-pin-soon">{SOON_SUFFIX}</tspan>}
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
  return (
    <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={mapOverlayStyle}>
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
