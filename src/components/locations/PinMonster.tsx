"use client";

import type { Location } from "@/data/locations";
import { monsterHref } from "@/components/mascots/Monster";
import { locationMonster } from "@/components/locations/locationArt";
import { PIN } from "@/components/locations/mapLayout";
import type { PinStyle } from "@/components/locations/MapPins";
import { useLateHour } from "@/lib/useLateHour";

/**
 * Idea 23: an open location's map pin sleeps while that store does, and
 * wakes with it — a small client component so the swap can live inside
 * `MapPinArt`, the one place both the home page's static map and the
 * `/locations` interactive map draw a pin from, rather than needing its own
 * copy in each. Only mounted for `loc.isOpen`: an unopened location's pin
 * sleeps unconditionally, with no clock to read, exactly as it does today.
 *
 * The server render matches `MapPinArt`'s old, always-awake markup for an
 * open location (`state` is null pre-mount), so there is nothing to
 * hydrate away from.
 */
export function PinMonster({ loc, style }: { loc: Location; style: PinStyle }) {
  const state = useLateHour(loc.id);
  const href = state?.closed ? "#cne-classic-sleep" : monsterHref(locationMonster(loc.id).body);

  return (
    <use
      href={href}
      className="cne-pin-mon"
      x={-12}
      y={PIN.headTop}
      width={24}
      height={24}
      style={style}
    />
  );
}
