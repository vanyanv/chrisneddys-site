"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Location } from "@/data/locations";
import { googleDirections, appleDirections, prefersAppleMaps } from "@/lib/directions";

/**
 * A "Get directions" link for one store, Apple Maps on Apple hardware and
 * Google Maps everywhere else — see `prefersAppleMaps` for why. The one place
 * that owns the mount-time detection, so every card gets it without hand-
 * rolling the same `useState`/`useEffect` pair again.
 */
export function DirectionsLink({
  loc,
  className,
  children,
  label,
}: {
  loc: Location;
  className?: string;
  children?: ReactNode;
  /** Accessible name, for when the visible text (an address) doesn't say it opens maps. */
  label?: string;
}) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(prefersAppleMaps()), []);

  return (
    <a
      className={className}
      href={apple ? appleDirections(loc) : googleDirections(loc)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      {children ?? "DIRECTIONS"}
    </a>
  );
}

/**
 * A store's street address that opens directions when tapped, which is what
 * visitors expect an address on a phone to do. Two lines unless `oneLine`.
 */
export function AddressLink({ loc, oneLine = false }: { loc: Location; oneLine?: boolean }) {
  const cityLine = `${loc.city}, ${loc.region} ${loc.postal}`;
  return (
    <DirectionsLink
      loc={loc}
      className="cne-addr-link"
      label={`Directions to ${loc.name}: ${loc.address}, ${cityLine}`}
    >
      {loc.address}
      {oneLine ? ", " : <br />}
      {cityLine}
    </DirectionsLink>
  );
}
