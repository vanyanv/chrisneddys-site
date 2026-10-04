"use client";

import { useSyncExternalStore } from "react";
import { MapCallout } from "@/components/locations/MapCallout";

/** The width at which home's map column appears (`.cne-split-r` in home.css). */
const DESKTOP = "(min-width: 901px)";

/**
 * Home's map callouts, mounted only while the map is on screen.
 *
 * Under 901px the home page hides its map column with `display: none`, but
 * each `MapCallout` still mounted there and kept its own minute timer running
 * for a tag nobody could see. The callouts render nothing until mounted
 * anyway (they depend on the visitor's clock), so waiting for the media query
 * changes nothing in the static HTML; it only spares phones the work. A window
 * resized across the breakpoint mounts or drops them to match.
 */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function DesktopMapCallouts({ locationIds }: { locationIds: string[] }) {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

  if (!desktop) return null;
  return locationIds.map((id) => <MapCallout key={id} locationId={id} />);
}
