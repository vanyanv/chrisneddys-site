"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { locations, type Location } from "@/data/locations";

type LocationId = Location["id"];

type Props = {
  selectedId: LocationId;
  onSelect: (id: LocationId) => void;
};

function pinSvg(loc: Location): string {
  const frame = loc.isOpen ? "#e63027" : "#f5b82e";
  const tag = loc.isOpen ? "OPEN" : "SOON";
  const tagFill = loc.isOpen ? "#1a1612" : "#1a1612";
  const tagText = loc.isOpen ? "#fff2c9" : "#fff2c9";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 116" width="80" height="96" style="overflow: visible;">
      <defs>
        <filter id="pin-shadow-${loc.id}" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="4" dy="5" stdDeviation="0" flood-color="#1a1612" flood-opacity="0.45" />
        </filter>
        <clipPath id="pin-clip-${loc.id}">
          <rect x="10" y="10" width="76" height="52" rx="3" />
        </clipPath>
      </defs>
      <g filter="url(#pin-shadow-${loc.id})">
        <!-- billboard frame -->
        <rect x="4" y="4" width="88" height="64" rx="6" fill="${frame}" stroke="#1a1612" stroke-width="3" />
        <!-- cream panel -->
        <rect x="10" y="10" width="76" height="52" rx="3" fill="#fff2c9" stroke="#1a1612" stroke-width="1.5" />
        <!-- logo inside panel -->
        <image href="/cne-logo.png" x="10" y="10" width="76" height="52" preserveAspectRatio="xMidYMid meet" clip-path="url(#pin-clip-${loc.id})" />
        <!-- post + pointer tail -->
        <path d="M 40 68 L 56 68 L 50 82 L 48 96 L 46 82 Z" fill="${frame}" stroke="#1a1612" stroke-width="3" stroke-linejoin="round" />
        <circle cx="48" cy="96" r="3.5" fill="#1a1612" />
      </g>
      <!-- status tag -->
      <g transform="translate(0 98)">
        <rect x="24" y="0" width="48" height="16" rx="2" fill="${tagFill}" stroke="#1a1612" stroke-width="2" />
        <text x="48" y="12" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${tagText}" letter-spacing="1.5">${tag}</text>
      </g>
    </svg>
  `;
}

export function LocationsMap({ selectedId, onSelect }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<LocationId, L.Marker>>(
    {} as Record<LocationId, L.Marker>,
  );

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const map = L.map(mapEl.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      keyboard: true,
      minZoom: 10,
      maxZoom: 15,
      maxBounds: L.latLngBounds(
        L.latLng(33.85, -118.75),
        L.latLng(34.42, -118.05),
      ),
      maxBoundsViscosity: 0.9,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    L.control
      .attribution({ prefix: false, position: "bottomright" })
      .addAttribution("© OpenStreetMap")
      .addTo(map);

    // Move zoom control to bottom-left so ribbon badge owns the top-left
    map.zoomControl.setPosition("bottomleft");

    // Create markers
    locations.forEach((loc) => {
      const icon = L.divIcon({
        className: `cne-pin cne-pin-${loc.id}`,
        html: pinSvg(loc),
        iconSize: [80, 96],
        iconAnchor: [40, 80],
      });

      const marker = L.marker([loc.lat, loc.lng], {
        icon,
        keyboard: true,
        title: loc.name,
        riseOnHover: true,
        alt: `${loc.name} — ${loc.status}`,
      }).addTo(map);

      marker.on("click", () => onSelect(loc.id));
      marker.on("keypress", (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") {
          onSelect(loc.id);
        }
      });

      markersRef.current[loc.id] = marker;
    });

    // Fit bounds to all pins
    const bounds = L.latLngBounds(
      locations.map((l) => [l.lat, l.lng] as [number, number]),
    );
    map.fitBounds(bounds, {
      padding: [70, 70],
      animate: !reduced,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {} as Record<LocationId, L.Marker>;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to selection changes: fly to pin + toggle "selected" class for CSS scale
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const loc = locations.find((l) => l.id === selectedId);
    if (!loc) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      map.setView([loc.lat, loc.lng], 13);
    } else {
      map.flyTo([loc.lat, loc.lng], 13, { duration: 0.9 });
    }

    // Toggle selected class on marker elements
    (Object.keys(markersRef.current) as LocationId[]).forEach((id) => {
      const el = markersRef.current[id]?.getElement();
      if (!el) return;
      el.classList.toggle("cne-pin-selected", id === selectedId);
    });
  }, [selectedId]);

  return (
    <div style={wrapStyle}>
      <div ref={mapEl} style={mapInnerStyle} aria-label="Map of Chris N Eddy's locations in Los Angeles" role="region" />
      <div style={ribbonStyle} aria-hidden="true">
        <span style={ribbonInnerStyle}>LOS ANGELES · CA</span>
      </div>
      <div style={legendStyle} aria-hidden="true">
        <div style={legendRow}>
          <span style={{ ...legendSwatch, background: "var(--color-cne-red)" }} />
          <span>OPEN</span>
        </div>
        <div style={legendRow}>
          <span style={{ ...legendSwatch, background: "var(--color-cne-yellow)" }} />
          <span>SOON</span>
        </div>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "relative",
  border: "4px solid var(--color-cne-ink)",
  boxShadow: "8px 8px 0 var(--color-cne-red)",
  background: "var(--color-cne-paper)",
  overflow: "hidden",
  isolation: "isolate",
  zIndex: 0,
  height: "100%",
  minHeight: 480,
};

const mapInnerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 472,
  background: "var(--color-cne-paper)",
};

const ribbonStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: -10,
  zIndex: 500,
  transform: "rotate(-4deg)",
  pointerEvents: "none",
};

const ribbonInnerStyle: CSSProperties = {
  display: "inline-block",
  background: "var(--color-cne-ink)",
  color: "var(--color-cne-cream)",
  padding: "8px 18px",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  letterSpacing: 3,
  textTransform: "uppercase",
  border: "3px solid var(--color-cne-cream)",
  boxShadow: "4px 4px 0 var(--color-cne-red)",
};

const legendStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  right: 18,
  zIndex: 500,
  background: "var(--color-cne-cream)",
  border: "3px solid var(--color-cne-ink)",
  boxShadow: "4px 4px 0 var(--color-cne-ink)",
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  letterSpacing: 1.5,
  fontWeight: 700,
  color: "var(--color-cne-ink)",
  pointerEvents: "none",
};

const legendRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const legendSwatch: CSSProperties = {
  width: 14,
  height: 14,
  border: "2px solid var(--color-cne-ink)",
  display: "inline-block",
};
