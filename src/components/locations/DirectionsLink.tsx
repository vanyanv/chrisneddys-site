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
}: {
  loc: Location;
  className?: string;
  children?: ReactNode;
}) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(prefersAppleMaps()), []);

  return (
    <a
      className={className}
      href={apple ? appleDirections(loc) : googleDirections(loc)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children ?? "DIRECTIONS"}
    </a>
  );
}
