/**
 * The pure rule behind "is this product ready to publish" — no database, no
 * filesystem, no server-only API, on purpose. `setStatus` (`@/lib/catalogAdmin`)
 * is the actual gate: it re-derives `PublishReadiness` from the database on
 * every call and is the only place a publish is ever really refused. The
 * rack panel (`RackProductPanel.tsx`, a client component) imports this same
 * module to build a live "what's still missing" checklist so an owner can
 * see what's outstanding before reaching for the Live chip.
 *
 * Both callers can safely import this leaf module directly because it has
 * nothing here to drag into a browser bundle — keep it that way. If a
 * change needs anything beyond plain booleans and strings, it belongs in
 * `catalogAdmin.ts` instead, not here.
 */

/** The four things a product must have before `setStatus` will let it go
 * live, in the order the panel lays the fields out (see
 * `PUBLISH_REQUIREMENT_MESSAGES` below for what each one says when it's
 * missing). */
export type PublishRequirementKey = "name" | "price" | "run" | "photo";

/**
 * The booleans `setStatus` needs to know a product is ready to publish —
 * issue #36's decisions comment: an unnamed draft is a first-class state,
 * not a placeholder, so this is the one place that honesty is actually
 * enforced rather than just a disabled button in the UI. Pulled out as its
 * own type (rather than passing the four raw checks as positional
 * arguments) so `missingPublishRequirements` reads as "what does this
 * product have" at every call site.
 */
export type PublishReadiness = {
  /** `displayName1` — the line the shop actually renders; a blank
   * `[SECOND COLOURWAY]`-style draft has none until the owner types one. */
  hasName: boolean;
  /** `priceCents` above zero — the $0 a fresh draft starts at isn't a real
   * price. */
  hasPrice: boolean;
  /** The variant tracks a quantity or an edition size — plain `untracked`
   * means the owner hasn't decided how many exist yet. */
  hasRunSize: boolean;
  /** At least one gallery (`view`) image — `firstView` (in
   * `src/data/merch.ts`) has to return something for the shop index and the
   * product page to render, and a product with zero `view` images is
   * exactly the case that used to render an empty $0 line instead. */
  hasPhoto: boolean;
};

/**
 * Which of `PublishReadiness`'s checks a product still fails, in the order
 * `setStatus` enforces them — so the first key in the result is always the
 * first thing an owner would need to fix. Empty means the product may
 * publish. Pure and side-effect-free on purpose: it's the shared predicate
 * both `setStatus` (the actual gate) and the rack panel's live checklist
 * (a preview of that gate, never a substitute for it) key off of.
 */
export function missingPublishRequirements(readiness: PublishReadiness): PublishRequirementKey[] {
  const missing: PublishRequirementKey[] = [];
  if (!readiness.hasName) missing.push("name");
  if (!readiness.hasPrice) missing.push("price");
  if (!readiness.hasRunSize) missing.push("run");
  if (!readiness.hasPhoto) missing.push("photo");
  return missing;
}

/** `setStatus`'s refusal message for each `PublishRequirementKey` — only
 * the first missing one is ever shown. */
export const PUBLISH_REQUIREMENT_MESSAGES: Record<PublishRequirementKey, string> = {
  name: "Give it a name before publishing.",
  price: "Set a price before publishing.",
  run: "Set a run size before publishing.",
  photo: "Add at least one photo before publishing.",
};

/** "a name" / "a run size" — the noun phrase the rack panel's standing
 * checklist caption uses for each requirement, distinct from
 * `PUBLISH_REQUIREMENT_MESSAGES`'s full refusal sentences: the panel reads
 * these out in a single joined sentence ("Needs a name and a photo..."),
 * `setStatus` shows only one message at a time. */
export const PUBLISH_REQUIREMENT_NOUNS: Record<PublishRequirementKey, string> = {
  name: "a name",
  price: "a price",
  run: "a run size",
  photo: "a photo",
};

/** "a name and a photo" / "a name, a price and a photo" — the sentence the
 * rack panel's standing checklist caption reads, built from whichever
 * requirements `missingPublishRequirements` found still missing. */
export function joinRequirements(keys: PublishRequirementKey[]): string {
  const nouns = keys.map((key) => PUBLISH_REQUIREMENT_NOUNS[key]);
  if (nouns.length < 2) return nouns.join("");
  const last = nouns[nouns.length - 1];
  return `${nouns.slice(0, -1).join(", ")} and ${last}`;
}
