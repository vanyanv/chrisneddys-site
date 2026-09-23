import { locations, type Location } from "@/data/locations";
import { mapBox, projectX, projectY, pxPerKm } from "@/data/laGeo";

/**
 * Where everything drawn on top of the LA map sits, in the map's own units
 * (the 360 x 259 viewBox every layer shares).
 *
 * The map's layers are drawn by different components — street lettering by
 * the server-rendered `LocationsMapCanvas`, pins by `MapPins`/`LocationsView`,
 * the open-now tag by the client-only `MapCallout` — so none of them can see
 * the others at render time. This file is what they agree on instead: each
 * pin, each tag and each fixed plate declares the box it occupies, and the
 * lettering (`mapLettering.ts`) drops or nudges any label that would land on
 * one. Nothing here imports the heavy path data, so the client components can
 * read it without pulling that into their bundle.
 */

export type Box = { x0: number; y0: number; x1: number; y1: number };

export const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Every glyph in JetBrains Mono advances 0.6em, so a label's width is arithmetic. */
export const monoWidth = (text: string, size: number, spacing: number): number =>
  text.length * (size * 0.6 + spacing);

export const TWO_MILES = 3.2187 * pxPerKm;

/** A pin's drawn parts, relative to the point it marks. */
export const PIN = {
  /** The monster head: 24 wide, sitting on a point 8 tall. */
  headTop: -32,
  /** Half the head's width once `.is-selected` scales it up by 1.22. */
  headHalf: 15,
  capY: -38,
  capSize: 8,
  capSpacing: 0.9,
  soonSize: 6,
  /** The name plate's padding around its text. */
  platePadX: 2.5,
  /** Tap target: centred on the head, 44pt across on the narrowest phone. */
  hitY: -18,
  hitR: 22,
} as const;

export const SOON_SUFFIX = " · SOON";

/** The name label's full width, including the "· SOON" tail a location that isn't open carries. */
export function capWidth(loc: Location): number {
  const name = monoWidth(loc.name, PIN.capSize, PIN.capSpacing);
  return loc.isOpen ? name : name + monoWidth(SOON_SUFFIX, PIN.soonSize, PIN.capSpacing);
}

export function pinPoint(loc: Location): { x: number; y: number } {
  return { x: projectX(loc.lng), y: projectY(loc.lat) };
}

/**
 * The head and point, and the name plate above them. The head's box runs a
 * few units below the point, so a street name can't sit directly under the
 * tip where it reads as the store's own address.
 */
export function pinBoxes(loc: Location): Box[] {
  const { x, y } = pinPoint(loc);
  const half = capWidth(loc) / 2 + PIN.platePadX + 3;
  return [
    { x0: x - PIN.headHalf, y0: y + PIN.headTop - 4, x1: x + PIN.headHalf, y1: y + 7 },
    { x0: x - half, y0: y + PIN.capY - 9, x1: x + half, y1: y + PIN.capY + 3 },
  ];
}

/**
 * The open-now tag (`MapCallout`) sits beside the head, never on it, and
 * points back at it. Only a location that is open gets one — a location that
 * hasn't opened says so in its own name label instead.
 */
export const TAG = {
  size: 6.5,
  spacing: 0.4,
  padX: 5,
  h: 15,
  /** From the pin's centre line to the tag's near edge, pointer included. */
  gap: 20,
  pointer: 5,
  /** Room reserved for the longest status line, "CLOSED · OPENS 10 AM". */
  reserveChars: 20,
} as const;

export type TagSide = "right" | "left";

function tagWidth(chars: number): number {
  return chars * (TAG.size * 0.6 + TAG.spacing) + TAG.padX * 2;
}

/** Right of the pin unless the longest status would run off the map. */
export function tagSide(loc: Location): TagSide {
  const { x } = pinPoint(loc);
  return x + TAG.gap + tagWidth(TAG.reserveChars) <= mapBox.w - 4 ? "right" : "left";
}

/** The tag's rectangle for `text`, or for the longest possible status when omitted. */
export function tagBox(loc: Location, text?: string): Box {
  const { x, y } = pinPoint(loc);
  const w = tagWidth(text ? text.length : TAG.reserveChars);
  const cy = y + PIN.headTop + 12;
  const near = TAG.gap - TAG.pointer;
  return tagSide(loc) === "right"
    ? { x0: x + near, y0: cy - TAG.h / 2, x1: x + TAG.gap + w, y1: cy + TAG.h / 2 }
    : { x0: x - TAG.gap - w, y0: cy - TAG.h / 2, x1: x - near, y1: cy + TAG.h / 2 };
}

/** The scale bar's left end, clear of the 405 shield in the bottom-left corner. */
export const SCALE_BAR = { x: 46, y: mapBox.h - 13 } as const;

/** Things drawn at a fixed spot: the scale bar, the ODbL attribution and the north arrow. */
export const PLATES: Box[] = [
  {
    x0: SCALE_BAR.x - 6,
    y0: SCALE_BAR.y - 8,
    x1: SCALE_BAR.x + TWO_MILES + 24,
    y1: SCALE_BAR.y + 8,
  },
  { x0: mapBox.w - 108, y0: mapBox.h - 13, x1: mapBox.w - 4, y1: mapBox.h - 1 },
  { x0: mapBox.w - 22, y0: 4, x1: mapBox.w - 10, y1: 30 },
];

/** Everything street lettering must stay off. */
export function reservedBoxes(): Box[] {
  return [
    ...PLATES,
    ...locations.flatMap(pinBoxes),
    ...locations.filter((l) => l.isOpen).map((l) => tagBox(l)),
  ];
}
