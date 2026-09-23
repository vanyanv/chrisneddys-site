import { mapBox } from "@/data/laGeo";
import { namedStreets, shields } from "@/data/laGeoPaths";
import { monoWidth, overlaps, reservedBoxes, type Box } from "@/components/locations/mapLayout";

/**
 * Which street names and freeway shields the map prints, and where.
 *
 * Server-only in practice: it reads `laGeoPaths`, which is ~94 KB of path
 * data, so only `LocationsMapCanvas` imports it. Pins, tags and plates win;
 * a label that would land on one of them (see `mapLayout.ts`) is dropped
 * rather than drawn underneath, and one that only runs off the right edge
 * slides back in by up to `SLIDE` units. A shield that clips something is
 * nudged sideways along its freeway first.
 */

/** `.cne-map-label`: 5.4 units, 0.85 letter-spacing, a 2.2 halo. */
const LABEL = { size: 5.4, spacing: 0.85, halo: 1.1 } as const;
const EDGE = 3;
const SLIDE = 20;
const SHIELD_NUDGE = [0, 3, -3, 6, -6];
const GAP = 2.5;

const grow = (b: Box, d: number): Box => ({
  x0: b.x0 - d,
  y0: b.y0 - d,
  x1: b.x1 + d,
  y1: b.y1 + d,
});

export type PlacedLabel = { name: string; x: number; y: number };
export type PlacedShield = { ref: string; x: number; y: number };

export function labelBox(name: string, x: number, baseline: number): Box {
  return {
    x0: x - LABEL.halo,
    y0: baseline - LABEL.size * 0.8 - LABEL.halo,
    x1: x + monoWidth(name, LABEL.size, LABEL.spacing) + LABEL.halo,
    y1: baseline + LABEL.halo + 0.4,
  };
}

export const shieldBox = (x: number, y: number): Box => ({
  x0: x - 7.5,
  y0: y - 5,
  x1: x + 7.5,
  y1: y + 5,
});

/**
 * The street a store is actually on, labelled beside it. The OSM label for
 * Sunset sits miles west, near the 405, so without this the one street in the
 * address was never named anywhere near the pin. Placed first, so it wins.
 */
const STORE_STREETS: PlacedLabel[] = [{ name: "SUNSET BLVD", x: 233, y: 202 }];

const inside = (b: Box): boolean =>
  b.x0 >= EDGE && b.y0 >= EDGE && b.x1 <= mapBox.w - EDGE && b.y1 <= mapBox.h - EDGE;

export function placeMapLettering(): { labels: PlacedLabel[]; shields: PlacedShield[] } {
  const taken = reservedBoxes();

  // A shield is 15 wide and sits on its freeway, so a few units either way
  // still reads as that road's — nudge before giving up on one.
  const keptShields: PlacedShield[] = [];
  for (const s of shields) {
    for (const dx of SHIELD_NUDGE) {
      const b = shieldBox(s.x + dx, s.y);
      if (!inside(b) || taken.some((t) => overlaps(t, b))) continue;
      taken.push(b);
      keptShields.push({ ref: s.ref, x: s.x + dx, y: s.y });
      break;
    }
  }

  const candidates: PlacedLabel[] = [
    ...STORE_STREETS,
    ...namedStreets.map((s) => ({ name: s.name, x: s.label[0], y: s.label[1] - 2.6 })),
  ];

  // Street names also keep a little air between each other, so two never
  // stack into what reads as one two-line label.
  const placed: Box[] = [];
  const labels: PlacedLabel[] = [];
  for (const c of candidates) {
    if (labels.some((l) => l.name === c.name)) continue;
    let x = c.x;
    let b = labelBox(c.name, x, c.y);
    const over = b.x1 - (mapBox.w - EDGE);
    if (over > 0 && over <= SLIDE) {
      x -= over;
      b = labelBox(c.name, x, c.y);
    }
    if (!inside(b) || taken.some((t) => overlaps(t, b))) continue;
    if (placed.some((t) => overlaps(t, grow(b, GAP)))) continue;
    taken.push(b);
    placed.push(b);
    labels.push({ name: c.name, x, y: c.y });
  }

  return { labels, shields: keptShields };
}
