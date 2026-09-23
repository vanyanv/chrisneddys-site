"use client";

import { statusParts } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The live open line above the headline — "OPEN · TILL 1 AM", "LAST CALL ·
 * 25 MIN", "CLOSED · OPENS 10 AM". Built from the same `useStoreStatus` /
 * `statusParts` pair the header's status tag reads (`OpenStatus.tsx`), so the
 * hero can never disagree with the header about whether the store is open.
 * Hollywood only — this hero has one order button, not a location picker,
 * so the word itself has no reason to appear here.
 *
 * `statusParts` is read directly rather than through `hours.ts`'s
 * `statusLabel`: that helper drops the separating dot for the open state
 * ("OPEN TILL 1 AM") to save width in the header's tag. This line has the
 * room to keep it, so all three states read the same shape.
 *
 * Null until mounted — the site is a static export and has no clock at build
 * time (see `useStoreStatus`) — so `.cne-hero-open` reserves its own height
 * in CSS and this renders nothing rather than shifting the headline down
 * once the real status resolves.
 */
export function HeroOpenLine() {
  const status = useStoreStatus("hollywood");
  const parts = status ? statusParts(status) : null;
  const tone =
    status?.state === "closed" ? "is-shut" : status?.state === "last-call" ? "is-last" : "";

  if (!parts) return <p className="cne-hero-open" />;

  const word = `${parts.state.short}${parts.state.rest}`;
  const fact = parts.time.value
    ? parts.time.lead
      ? `${parts.time.lead} ${parts.time.value}`
      : parts.time.value
    : "";

  return (
    <p className={`cne-hero-open ${tone}`.trim()}>
      <span className="cne-hero-open-dot" aria-hidden="true" />
      <span aria-hidden="true">{fact ? `${word} · ${fact}` : word}</span>
      <span className="cne-sr-only">{parts.aria}</span>
    </p>
  );
}
