import type { CSSProperties } from "react";

/** The custom property `cne-classic-sleep` (`MascotDefs`) reads. */
type SleepStyle = CSSProperties & { "--m-body"?: string };

/**
 * Idea 11: the sold-out corner badge. Sits in the same spot the awake
 * `Monster` badge uses (`cne-badge-corner is-tr`) when a product isn't sold
 * out, but asleep, with a small floating "z". Raw `<use>` rather than the
 * `Monster` component since `cne-classic-sleep` isn't in its species union —
 * this is the only place that needs it.
 */
export function SleepingBadge({ size = 26 }: { size?: number }) {
  const style: SleepStyle = { "--m-body": "#2e5fd9" };
  return (
    <span className="cne-badge-corner is-tr cne-sleep-badge" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 200 200" style={style}>
        <use href="#cne-classic-sleep" />
      </svg>
      <span className="cne-sleep-z">z</span>
    </span>
  );
}
