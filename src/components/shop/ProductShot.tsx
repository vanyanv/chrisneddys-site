import { CapArt, type CapView } from "./CapArt";
import type { MerchProduct, MerchView } from "@/data/merch";

/**
 * One product image.
 *
 * Three sources, tried in order: a per-view photo (`view.photo`, under the
 * product's own `photoDir`) for a product shot the way the Foam Trucker is;
 * the legacy `product.photo` — the same Otter asset the menu row for a cap
 * used, for a product that still shares that one file; and `CapArt`, the
 * drawing, for any view that has neither yet. That last case is not an edge
 * case today — it is every view on the Foam Trucker, until the photography
 * lands.
 *
 * The frame is fixed by `.cne-capshot` at every size it appears, so whichever
 * source renders occupies exactly the same box and nothing on the page moves
 * when a product crosses over from the drawing to a photograph.
 */
export function ProductShot({
  product,
  view,
  sizes,
  priority = false,
  className = "",
  thumb = false,
}: {
  product: MerchProduct;
  view: MerchView;
  /** Passed straight to the <img>; the two cuts are 200px and 720px. */
  sizes: string;
  /** The product page's main shot is the largest paint on that route. */
  priority?: boolean;
  className?: string;
  /**
   * True inside the thumbnail strip, where every tile is square regardless of
   * the source photo's own aspect ratio — so the per-view aspect ratio below
   * is skipped and `.cne-pdp-t .cne-capshot`'s `1 / 1` rule wins instead.
   */
  thumb?: boolean;
}) {
  if (view.photo) {
    const { src, width, height } = view.photo;
    const base = `${product.photoDir ?? ""}/${src}`;

    return (
      <div
        className={`cne-capshot is-photo ${className}`.trim()}
        style={thumb ? undefined : { aspectRatio: `${width} / ${height}` }}
      >
        <img
          src={`${base}.webp`}
          srcSet={`${base}-thumb.webp 200w, ${base}.webp 720w`}
          sizes={sizes}
          alt={view.caption}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? "sync" : "async"}
        />
      </div>
    );
  }

  if (product.photo) {
    const src = `/menu/${product.photo}.webp`;

    return (
      <div className={`cne-capshot is-photo ${className}`.trim()}>
        <img
          src={src}
          srcSet={`/menu/${product.photo}-thumb.webp 200w, ${src} 720w`}
          sizes={sizes}
          alt={view.caption}
          width={720}
          height={411}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? "sync" : "async"}
        />
      </div>
    );
  }

  return <CapArt view={view.id as CapView} color={product.capColor} className={className} />;
}
