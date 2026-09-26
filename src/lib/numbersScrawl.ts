/**
 * A deterministic scatter of short numbers for the blacklight hallway motif
 * (idea 18, extended by idea 44) — the back hallway's lime scrawl of numbers
 * under blacklight, reused behind the Open late section and, during the
 * blacklight hour, behind the footer.
 *
 * Seeded with a tiny linear congruential generator rather than `Math.random`
 * so the server's first render and the client's hydration produce the exact
 * same numbers in the exact same places. A mismatch here would be a
 * hydration warning on every store page.
 */

export type ScrawlNumber = {
  /** Position, in the 0-100 square the caller's viewBox is drawn in. */
  x: number;
  y: number;
  /** Rotation in degrees, applied around (x, y). */
  rot: number;
  /** Relative size, meant to be read as an `em` multiplier on the
   * container's own font-size. */
  scale: number;
  /** The digits themselves. */
  text: string;
  /** A shuffled 0..count-1 index, so a flicker-in stagger keyed off it does
   * not fire in left-to-right reading order. */
  i: number;
};

const DIGITS = "8952183140567236891524730";

export function numberScrawl(seed: number, count: number): ScrawlNumber[] {
  let k = seed;
  const rnd = () => (k = (k * 9301 + 49297) % 233280) / 233280;
  const out: ScrawlNumber[] = [];
  for (let n = 0; n < count; n++) {
    const digitCount = rnd() < 0.45 ? 1 : rnd() < 0.75 ? 2 : 3;
    let text = "";
    for (let d = 0; d < digitCount; d++) text += DIGITS[Math.floor(rnd() * DIGITS.length)];
    out.push({
      x: Math.round(rnd() * 1000) / 10,
      y: Math.round(rnd() * 1000) / 10,
      rot: Math.round((rnd() * 30 - 15) * 10) / 10,
      scale: Math.round((0.7 + rnd() * 0.6) * 100) / 100,
      text,
      i: Math.floor(rnd() * count),
    });
  }
  return out;
}

/** A stable seed from a location id, so each store's page scatters its
 * numbers a little differently without depending on anything client-only. */
export function seedFromId(id: string): number {
  let s = 7;
  for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 9973;
  return s + 1;
}
