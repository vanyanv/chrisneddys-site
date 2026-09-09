import type { Location } from "@/data/locations";

/**
 * A "Get directions" button should end in turn-by-turn navigation, not in
 * another map widget. Hand the visitor off to the app they were always going
 * to finish in — Apple Maps on Apple hardware, Google Maps everywhere else.
 */
export function googleDirections(loc: Location): string {
  const q = encodeURIComponent(
    `Chris N Eddy's, ${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim(),
  );
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function appleDirections(loc: Location): string {
  const q = encodeURIComponent(
    `Chris N Eddy's, ${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim(),
  );
  return `https://maps.apple.com/?daddr=${q}`;
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
