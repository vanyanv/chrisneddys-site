import type { CSSProperties } from "react";

/**
 * The cap, drawn.
 *
 * There is no photography of the Foam Trucker yet, and a stock photo of
 * somebody else's hat would be worse than nothing — so the product image is an
 * illustration built out of four elements and a pair of border-radii, in the
 * brand's own ink. It costs no bytes, it is sharp at every size, and it is
 * theme-aware in a way a JPEG never is.
 *
 * It carries no embroidery. It used to have "5539 / W. SUNSET BLVD" stitched
 * across the crown, which was a drawing of artwork nobody had seen — the same
 * class of invention as a fabric weight. A plain silhouette claims only that
 * the product is a cap, which is all that is known until the photography
 * lands. `color` lets a product tint the drawing without a new stylesheet
 * rule per product — the Foam Trucker is royal blue, everything else stays
 * the ink-black default.
 *
 * The important part is the geometry: `.cne-capshot` fixes the aspect ratio at
 * every size it is used, so when real shots do land they drop into containers
 * that are already the right shape and nothing on the page has to move.
 */

export type CapView =
  | "front"
  | "front-plain"
  | "angle"
  | "angle-plain"
  | "cyclops"
  | "stitch"
  | "snap"
  | "back";

/** Per-angle transforms, so the eight gallery tabs read as eight different looks. */
const VIEW_TRANSFORM: Record<CapView, string> = {
  /* The tilt the social card uses. A cap sitting dead level on a flat panel
     reads as a logo; seven degrees reads as an object on a shelf. */
  front: "rotate(-7deg)",
  "front-plain": "rotate(-5deg)",
  angle: "rotate(-7deg) scale(1.04)",
  "angle-plain": "rotate(7deg) scale(1.04) scaleX(-1)",
  cyclops: "scale(1.55) translateY(2%)",
  stitch: "scale(1.34) translateY(6%)",
  snap: "rotate(4deg) scaleX(-1) scale(1.15)",
  back: "rotate(4deg) scaleX(-1)",
};

export function CapArt({
  view = "front",
  tag,
  color,
  className = "",
}: {
  view?: CapView;
  /** Corner caption — used for the honest "illustration" note. */
  tag?: string;
  /** CSS color for the crown/brim/button — leave unset for ink-black. */
  color?: string;
  className?: string;
}) {
  return (
    <div className={`cne-capshot ${className}`.trim()}>
      {/* The halftone the rest of the site uses on red panels, at low opacity so
          it reads as newsprint behind the product rather than as a texture on it. */}
      <span className="cne-capshot-dots" aria-hidden="true" />
      <div
        className="cne-cap"
        aria-hidden="true"
        style={
          {
            "--cne-cap-t": VIEW_TRANSFORM[view],
            ...(color ? { "--cne-cap-c": color } : {}),
          } as CSSProperties
        }
      >
        <span className="btn" />
        <span className="crown" />
        <span className="brim" />
      </div>
      {tag ? <span className="cne-capshot-tag">{tag}</span> : null}
    </div>
  );
}
