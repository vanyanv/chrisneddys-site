"use client";

import { locations } from "@/data/locations";
import { mapBox } from "@/data/laGeo";
import { statusLabel } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";
import { mapOverlayStyle } from "@/components/locations/MapPins";
import { TAG, pinPoint, tagBox, tagSide } from "@/components/locations/mapLayout";

/** Above the pins, and never in the way of a tap on one. */
const tagLayer = { ...mapOverlayStyle, zIndex: 2, pointerEvents: "none" as const };

/**
 * The tag beside an open store's pin saying whether it is open right now.
 *
 * It sits beside the monster's head and points back at it, on whichever side
 * `mapLayout.ts` picked, so it can never cover the pin or the store's name;
 * street lettering already stays out of the room it reserves. Drawn in the
 * map's own units, so it scales with the map instead of sitting at one pixel
 * size over a map that is 390 wide on a phone and 900 on a desktop.
 *
 * A store that hasn't opened gets no tag: its name label already says SOON.
 *
 * Client-side because the answer depends on the visitor's clock, not the build:
 * see `useStoreStatus`. It renders nothing until mounted, which keeps the
 * static export free of a status it cannot know.
 */
export function MapCallout({ locationId = "hollywood" }: { locationId?: string }) {
  const loc = locations.find((l) => l.id === locationId);
  const status = useStoreStatus(locationId);
  if (!loc || !loc.isOpen || !status) return null;

  const text = statusLabel(status).toUpperCase();
  if (!text) return null;

  const box = tagBox(loc, text);
  const { x } = pinPoint(loc);
  const cy = (box.y0 + box.y1) / 2;
  const right = tagSide(loc) === "right";
  const edge = right ? x + TAG.gap : x - TAG.gap;
  const tip = right ? edge - TAG.pointer : edge + TAG.pointer;

  return (
    <svg viewBox={`0 0 ${mapBox.w} ${mapBox.h}`} aria-hidden="true" style={tagLayer}>
      <g className="cne-map-tag">
        <path className="ptr" d={`M${edge},${cy - 3.6} L${tip},${cy} L${edge},${cy + 3.6} Z`} />
        <rect
          x={right ? edge : box.x0}
          y={box.y0}
          width={box.x1 - box.x0 - TAG.pointer}
          height={TAG.h}
          rx={1.5}
        />
        <text x={(right ? edge : box.x0) + TAG.padX} y={cy + TAG.size * 0.36}>
          {text}
        </text>
      </g>
    </svg>
  );
}
