/** Shared by the sheet's rows and the editor's "Saved …" footer — a glance
 * column, not an audit log, so this stays coarse on purpose. */
export function relativeTime(date: Date | number): string {
  const ms = typeof date === "number" ? date : date.getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatPrice(cents: number): string {
  return `$${formatDollars(cents)}`;
}

/**
 * The rack card/panel's title: `displayName1` and `displayName2` joined with
 * a space ("THE FOAM TRUCKER" + "— BLUE" -> "THE FOAM TRUCKER — BLUE"),
 * trimmed, or `""` when both are blank.
 *
 * Deliberately returns `""` rather than a fallback — an unnamed draft
 * (issue #36's decisions comment: `[SECOND COLOURWAY]`, first-class, not a
 * placeholder) genuinely has no name yet, and the caller renders that
 * honestly (a muted "No name yet" note) instead of this function inventing
 * one. `setStatus` in `@/lib/catalogAdmin` is what refuses to publish while
 * it's blank — this is only ever a display concern.
 */
export function productTitle(displayName1: string, displayName2: string): string {
  return [displayName1, displayName2]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}
