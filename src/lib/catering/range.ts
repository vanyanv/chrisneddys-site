/**
 * Delivery range estimate: ZIP-centroid straight-line distance × 1.25 (a
 * fudge factor for actual driving distance, since there's no maps API),
 * rounded to 0.1 mile.
 *
 * `zipcodes` looks up each ZIP's centroid lat/lng and does the haversine
 * math itself. The lookup is injectable so this stays a plain, pure module
 * (no network) and so tests aren't tied to real ZIP data.
 */
import zipcodes from "zipcodes";

export const DRIVING_FUDGE_FACTOR = 1.25;

/** Straight-line miles between two ZIPs, or `null` when either ZIP is unknown. */
export type ZipDistanceLookup = (zipA: string, zipB: string) => number | null;

export const defaultZipDistance: ZipDistanceLookup = (zipA, zipB) => zipcodes.distance(zipA, zipB);

function roundToTenth(miles: number): number {
  return Math.round(miles * 10) / 10;
}

/**
 * Estimated driving miles between two ZIPs, or `null` when either ZIP isn't
 * in the lookup's data (an unknown ZIP is accepted by the order flow and
 * flagged for the owner rather than rejected — see the build plan).
 */
export function estimateMiles(
  storeZip: string,
  destZip: string,
  lookup: ZipDistanceLookup = defaultZipDistance,
): number | null {
  const straight = lookup(storeZip, destZip);
  if (straight === null || straight === undefined || Number.isNaN(straight)) return null;
  return roundToTenth(straight * DRIVING_FUDGE_FACTOR);
}

/** Whether an estimated distance is within the delivery range setting. */
export function inRange(miles: number | null, maxMiles: number): boolean {
  if (miles === null) return false;
  return miles <= maxMiles;
}
