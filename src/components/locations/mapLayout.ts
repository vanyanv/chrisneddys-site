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

/**
 * Advance widths, in ems, of Barlow Semi Condensed Bold (the map's label face,
 * `--font-mono` at weight 700) for the characters map labels use, read from
 * src/fonts/barlow-semi-condensed-latin-700.woff2. The face is proportional,
 * so a label's width is the sum of its letters; anything not listed counts as
 * 0.6em, a little wider than a typical capital.
 */
const ADVANCE: Record<string, number> = {
  " ": 0.2,
  "·": 0.23,
  ".": 0.247,
  ",": 0.238,
  "'": 0.169,
  "’": 0.196,
  "-": 0.37,
  "&": 0.654,
  ":": 0.319,
  "0": 0.511,
  "1": 0.319,
  "2": 0.499,
  "3": 0.487,
  "4": 0.544,
  "5": 0.488,
  "6": 0.488,
  "7": 0.451,
  "8": 0.49,
  "9": 0.482,
  A: 0.577,
  B: 0.545,
  C: 0.536,
  D: 0.547,
  E: 0.511,
  F: 0.49,
  G: 0.54,
  H: 0.554,
  I: 0.246,
  J: 0.518,
  K: 0.558,
  L: 0.499,
  M: 0.631,
  N: 0.59,
  O: 0.547,
  P: 0.531,
  Q: 0.527,
  R: 0.543,
  S: 0.52,
  T: 0.526,
  U: 0.554,
  V: 0.555,
  W: 0.783,
  X: 0.553,
  Y: 0.546,
  Z: 0.485,
};
const ADVANCE_FALLBACK = 0.6;

/** A label's drawn width at `size` with `spacing` letter-spacing after each character. */
export const labelWidth = (text: string, size: number, spacing: number): number =>
  [...text.toUpperCase()].reduce(
    (w, ch) => w + (ADVANCE[ch] ?? ADVANCE_FALLBACK) * size + spacing,
    0,
  );

export const TWO_MILES = 3.2187 * pxPerKm;

/** A pin's drawn parts, relative to the point it marks. */
export const PIN = {
  /** The monster head: 24 wide, sitting on a point 8 tall. */
  headTop: -32,
  /** Half the head's width once `.is-selected` scales it up by 1.22. */
  headHalf: 15,
  capY: -38,
  /** Read on a phone, where the map is about 400px for its 360 units: 9.5
      units is ~10.5px there, and the "· SOON" tail ~8px (issue #261; they
      were 8 and 6, under 9px and 7px). */
  capSize: 9.5,
  capSpacing: 0.9,
  soonSize: 7.5,
  /** The name plate's padding around its text, and its top and height. */
  platePadX: 2.5,
  plateTop: -9,
  plateH: 12,
  /** Tap target: centred on the head, 44pt across on the narrowest phone. */
  hitY: -18,
  hitR: 22,
} as const;

export const SOON_SUFFIX = " · SOON";

/** The name label's full width, including the "· SOON" tail a location that isn't open carries. */
export function capWidth(loc: Location): number {
  const name = labelWidth(loc.name, PIN.capSize, PIN.capSpacing);
  return loc.isOpen ? name : name + labelWidth(SOON_SUFFIX, PIN.soonSize, PIN.capSpacing);
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
    { x0: x - half, y0: y + PIN.capY + PIN.plateTop - 2, x1: x + half, y1: y + PIN.capY + 3 },
  ];
}

/**
 * The open-now tag (`MapCallout`) sits beside the head, never on it, and
 * points back at it. Only a location that is open gets one — a location that
 * hasn't opened says so in its own name label instead.
 */
export const TAG = {
  size: 7.5,
  spacing: 0.4,
  padX: 5,
  h: 17,
  /** From the pin's centre line to the tag's near edge, pointer included. */
  gap: 20,
  pointer: 5,
  /** Room reserved for the longest status line. */
  reserveText: "CLOSED · OPENS 10 AM",
} as const;

export type TagSide = "right" | "left";

function tagWidth(text: string): number {
  return labelWidth(text, TAG.size, TAG.spacing) + TAG.padX * 2;
}

/** Right of the pin unless the longest status would run off the map. */
export function tagSide(loc: Location): TagSide {
  const { x } = pinPoint(loc);
  return x + TAG.gap + tagWidth(TAG.reserveText) <= mapBox.w - 4 ? "right" : "left";
}

/** The tag's rectangle for `text`, or for the longest possible status when omitted. */
export function tagBox(loc: Location, text?: string): Box {
  const { x, y } = pinPoint(loc);
  const w = tagWidth(text || TAG.reserveText);
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
