"use client";

import { statusParts, type StatusParts } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The status tag: a two-cell punch card, not a capsule.
 *
 * The left cell names the state in the display face; the right cell carries
 * the one fact that state implies, reversed out on ink in the mono. Square
 * corners, an ink rule and a hard offset shadow, which is what everything else
 * on this site is made of — the 20px capsule this replaces was the only object
 * in the system that wasn't printed, and a soft rectangle is the delivery
 * app's vocabulary, not ours.
 *
 * Three widths, all handled in the stylesheet rather than by measuring the
 * viewport here: the connective word ("TILL", "OPENS") goes first, then the
 * state word when the state is one a green dot already tells you.
 *
 * State is carried three ways — dot color, fill, and the words themselves — so
 * it survives a screenshot in greyscale and does not depend on color alone.
 */
export function OpenStatus({
  locationId = "hollywood",
  head = false,
}: {
  locationId?: string;
  /** The header's tag runs a size up: it is the one people scan first. */
  head?: boolean;
}) {
  const status = useStoreStatus(locationId);

  return (
    <StatusTag
      parts={status ? statusParts(status) : null}
      tone={status?.state === "closed" ? "shut" : status?.state === "last-call" ? "last" : "open"}
      head={head}
    />
  );
}

/**
 * The tag itself, with no clock attached.
 *
 * The cells are `aria-hidden` and the whole sentence rides in a visually
 * hidden span, so a screen reader hears "Open until 1 AM" rather than the two
 * fragments the eye reads as one line. The live region announces the change
 * once, when it changes, rather than narrating every minute — only the state
 * and the closing time are in it, and neither moves between announcements.
 */
export function StatusTag({
  parts,
  tone = "open",
  head = false,
}: {
  /** Null until the clock is known. The tag holds its space and stays silent. */
  parts: StatusParts | null;
  tone?: "open" | "last" | "shut";
  head?: boolean;
}) {
  const cls = [
    "cne-stat",
    head ? "is-head" : "",
    tone === "shut" ? "is-shut" : tone === "last" ? "is-last" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} aria-live="polite">
      <span className="cne-stat-a" aria-hidden="true">
        <span className="cne-dot" />
        {parts && (
          <span className="cne-stat-word">
            {parts.state.short}
            {parts.state.rest && <span className="cne-stat-rest">{parts.state.rest}</span>}
          </span>
        )}
      </span>
      {parts?.time.value && (
        <span className="cne-stat-b" aria-hidden="true">
          {/* A literal trailing space is stripped by JSX, and this one is load
              bearing: without it the cell reads "TILL1 AM". Non-breaking, since
              the tag never wraps anyway. */}
          {parts.time.lead && <span className="cne-stat-lead">{parts.time.lead}&#160;</span>}
          {parts.time.value}
        </span>
      )}
      <span className="cne-sr-only">{parts?.aria ?? ""}</span>
    </span>
  );
}

/** A counter that has not opened yet. One cell, no clock, no promise. */
export function ComingSoonTag() {
  return (
    <StatusTag
      tone="shut"
      parts={{
        // One piece, not two: a location card has the width, and "COMING" on
        // its own after the phone drops the second half says nothing.
        state: { short: "COMING SOON", rest: "" },
        time: { lead: "", value: "" },
        aria: "Coming soon",
      }}
    />
  );
}
