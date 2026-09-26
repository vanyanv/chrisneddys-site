import { brand } from "@/data/brand";
import type { Location } from "@/data/locations";

/**
 * A "Get directions" button should end in turn-by-turn navigation, not in
 * another map widget. Hand the visitor off to the app they were always going
 * to finish in — Apple Maps on Apple hardware, Google Maps everywhere else.
 */
/**
 * What a maps app is asked to find for one store. The brand name goes in only
 * for a store the maps apps already list under it (`listedOnMaps`): for any
 * other, "Chris N Eddy's, 14523 Sherman Way, ..." matches the name to the
 * Hollywood listing and the route ends on Sunset Blvd. The bare street address
 * always lands on the right door.
 */
export function mapsQuery(loc: Location): string {
  const address = `${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim();
  return loc.listedOnMaps ? `${brand.name}, ${address}` : address;
}

export function googleDirections(loc: Location): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(loc))}`;
}

export function appleDirections(loc: Location): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(mapsQuery(loc))}`;
}

/**
 * True on iOS and iPadOS, where tapping a `maps.apple.com` link opens the Maps
 * app with the route already loaded.
 *
 * Desktop macOS is deliberately excluded. There the link either hands the
 * browser off to an app the visitor may not use, or lands on Apple's web map;
 * Google Maps just opens in the tab they are already in, and is where a "send
 * to phone" hand-off lives. The touch-point check is what separates the two,
 * since iPadOS 13+ reports itself as a Mac.
 *
 * Only safe to call after mount — the server has no way to know, so the Google
 * link is rendered first and swapped on the client. That keeps hydration
 * consistent and leaves a working link if JavaScript never arrives.
 */
export function prefersAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 0;
}
