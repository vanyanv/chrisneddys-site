"use client";

import { locations } from "@/data/locations";
import { mapBox, projectX, projectY } from "@/data/laGeo";
import { statusLabel } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The tag pinned to a store on the map — its name and whether it is open right
 * now, as in the prototype.
 *
 * Client-side because the answer depends on the visitor's clock, not the build:
 * see `useStoreStatus`. It renders nothing until mounted, which keeps the
 * static export free of a status it cannot know.
 */
export function MapCallout({ locationId = "hollywood" }: { locationId?: string }) {
  const loc = locations.find((l) => l.id === locationId);
  const status = useStoreStatus(locationId);
  if (!loc) return null;

  const state = loc.isOpen ? (status ? statusLabel(status) : "") : "Opening soon";
  if (!state) return null;

  return (
    <div
      className="cne-callout"
      style={{
        left: `${(projectX(loc.lng) / mapBox.w) * 100}%`,
        top: `${(projectY(loc.lat) / mapBox.h) * 100}%`,
      }}
    >
      {loc.name.toUpperCase()}
      <small>{state}</small>
    </div>
  );
}
