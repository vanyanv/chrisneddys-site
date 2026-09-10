import type { CSSProperties } from "react";

/**
 * The cap, drawn.
 *
 * There is no photography of this product yet, and a stock photo of somebody
 * else's hat would be worse than nothing — so the product image is an
 * illustration built out of four elements and a pair of border-radii, in the
 * brand's own ink. It costs no bytes, it is sharp at every size, and it is
 * theme-aware in a way a JPEG never is.
 *
 * It carries no embroidery. It used to have "5539 / W. SUNSET BLVD" stitched
 * across the crown, which was a drawing of artwork nobody has seen — the same
 * class of invention as a fabric weight. A plain silhouette claims only that
 * the product is a cap, which is all that is known.
 *
 * The important part is the geometry: `.cne-capshot` fixes the aspect ratio at
 * every size it is used, so when real shots do land they drop into containers
 * that are already the right shape and nothing on the page has to move.
 */

export type CapView = "cap" | "on" | "side" | "back" | "stitch";

/** Per-angle transforms, for when there is more than one shot to show. */
const VIEW_TRANSFORM: Record<CapView, string> = {
  /* The tilt the social card uses. A cap sitting dead level on a flat panel
     reads as a logo; seven degrees reads as an object on a shelf. */
  cap: "rotate(-7deg)",
  on: "none",
  side: "rotate(-7deg) scale(1.04)",
  back: "rotate(4deg) scaleX(-1)",
  stitch: "scale(1.34) translateY(6%)",
};

export function CapArt({
  view = "cap",
  tag,
  className = "",
}: {
  view?: CapView;
  /** Corner caption — used for the honest "illustration" note. */
  tag?: string;
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
        style={{ "--cne-cap-t": VIEW_TRANSFORM[view] } as CSSProperties}
      >
        <span className="btn" />
        <span className="crown" />
        <span className="brim" />
      </div>
      {tag ? <span className="cne-capshot-tag">{tag}</span> : null}
    </div>
  );
}
