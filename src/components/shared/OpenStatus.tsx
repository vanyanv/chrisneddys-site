"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { locations } from "@/data/locations";
import { storeStatus, statusLabel, type StoreStatus } from "@/lib/hours";

/**
 * "Are you open right now" is the question people actually arrive with, and
 * a table of hours makes them do the arithmetic — which is worse at 1 AM,
 * exactly when it matters most here.
 *
 * The site is a static export, so the server has no idea what time it is when
 * someone opens the page. The pill reserves its space in the HTML and fills in
 * on mount, which keeps the layout stable and avoids a hydration mismatch.
 */
export function OpenStatus({ locationId = "hollywood" }: { locationId?: string }) {
  const [status, setStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    const tick = () => setStatus(storeStatus(loc));
    tick();
    // A minute is enough: the only thing that moves is the countdown.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const label = status ? statusLabel(status) : "";
  const state = status?.state ?? "unknown";

  return (
    <span
      className="cne-open-status"
      style={{ ...pillStyle, ...toneFor(state) }}
      // Empty until mounted, so screen readers aren't told "" is meaningful.
      aria-hidden={status ? undefined : true}
      aria-live="polite"
    >
      <span style={{ ...dotStyle, ...dotToneFor(state) }} aria-hidden="true" />
      {label}
    </span>
  );
}

function toneFor(state: string): CSSProperties {
  if (state === "last-call") {
    return {
      background: "var(--color-cne-yellow)",
      color: "var(--color-cne-ink)",
      borderColor: "var(--color-cne-ink)",
    };
  }
  if (state === "closed") {
    return {
      background: "var(--color-cne-ink)",
      color: "var(--color-cne-cream)",
      borderColor: "var(--color-cne-ink)",
    };
  }
  return {
    background: "var(--color-cne-cream)",
    color: "var(--color-cne-ink)",
    borderColor: "var(--color-cne-ink)",
  };
}

function dotToneFor(state: string): CSSProperties {
  if (state === "closed") return { background: "var(--color-cne-red)" };
  if (state === "last-call") return { background: "var(--color-cne-red-deep, #b41d14)" };
  return { background: "#2f6b3f" };
}

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 92,
  minHeight: 26,
  justifyContent: "center",
  padding: "5px 10px",
  borderRadius: 20,
  border: "2px solid transparent",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  flex: "none",
};
