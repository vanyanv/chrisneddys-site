import { CapArt, type CapView } from "./CapArt";
import type { MerchProduct, MerchView } from "@/data/merch";
import { thumbStripSrcSet } from "@/lib/productImage";

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
 * `view` itself can be `undefined` — `firstView` (`src/data/merch.ts`)
 * returns that for a product with no gallery images at all, which a
 * still-unpublished draft can be. `CapArt` is the fallback there too, same
 * as any view with no photo.
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
  cropToFrame = false,
}: {
  product: MerchProduct;
  view: MerchView | undefined;
  /**
   * Passed straight to the <img>. The cuts are 200px and 720px, plus a 400px
   * one offered to the thumbnail strip — see `srcSet` below.
   */
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
  /**
   * True where the frame around the shot sets its own crop and the photo's
   * real aspect ratio must not fight it — the /shop/ index card, whose
   * `.cne-drop-art .cne-capshot.is-photo` rule wants every card the same
   * shape regardless of what the photo itself happens to be (a square Foam
   * Trucker shot next to a future widescreen one). Skips the same inline
   * `aspectRatio` that `thumb` skips, for the same reason: so the frame's
   * own CSS ratio is the only one in play instead of losing to an inline
   * style. The product page's main shot leaves this off on purpose — there
   * the photo's real shape is the point.
   */
  cropToFrame?: boolean;
}) {
  if (!view) {
    return <CapArt color={product.capColor} className={className} />;
  }

  if (view.photo) {
    const { src, width, height, url, midUrl, thumbUrl } = view.photo;
    const base = `${product.photoDir ?? ""}/${src}`;
    const fullSrc = url ?? `${base}.webp`;
    const thumbSrc = thumbUrl ?? `${base}-thumb.webp`;
    // The 400px cut sits between the thumbnail and the full shot, and only the
    // thumbnail strip offers it. A tile there is drawn 50-175px wide, which on
    // a 2x or 3x screen — nearly every phone, and most laptops — needs more
    // than 200 source pixels, so with only 200 and 720 to choose from the
    // browser took the 720 for all eight tiles and pulled the entire gallery
    // down at full size. The main shot deliberately keeps the original pair:
    // it is drawn 284-778px wide, where 720 is the right file at any density,
    // and leaving its candidates alone means the photograph a customer
    // actually studies is the same file it has always been.
    //
    // Repo photography built by `scripts/build-shop-images.mjs` always has the
    // middle cut. An image uploaded through /admin (issue #151) gets one too
    // — `POST /api/admin/upload` writes a `-mid` Blob alongside the thumb and
    // full cuts and stores its URL as `midUrl` — but a row uploaded before
    // that shipped has no `midUrl` (there is no backfill) and falls back to
    // the plain 200w/720w pair, same as it always rendered. See
    // `thumbStripSrcSet` (`src/lib/productImage.ts`) for the three cases.
    const srcSet = thumbStripSrcSet({ thumb, base, thumbSrc, fullSrc, url, thumbUrl, midUrl });

    return (
      <div
        className={`cne-capshot is-photo ${className}`.trim()}
        style={thumb || cropToFrame ? undefined : { aspectRatio: `${width} / ${height}` }}
      >
        <img
          src={fullSrc}
          srcSet={srcSet}
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
