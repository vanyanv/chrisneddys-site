import { CapArt, type CapView } from "./CapArt";
import type { MerchProduct, MerchView } from "@/data/merch";

/**
 * One product image.
 *
 * The photograph is Otter's — the same file the menu row for the cap uses, so
 * there is one asset on disk and one upload to redo when the shot changes.
 * `CapArt` stays as the fallback for any product added before its photo is,
 * which is why this component exists rather than an `<img>` at each call site.
 *
 * The frame is fixed by `.cne-capshot` at every size it appears, so the drawing
 * and the photograph occupy exactly the same box and nothing on the page moves
 * when a product crosses over from one to the other.
 */
export function ProductShot({
  product,
  view,
  sizes,
  priority = false,
  className = "",
}: {
  product: MerchProduct;
  view: MerchView;
  /** Passed straight to the <img>; the two cuts are 200px and 720px. */
  sizes: string;
  /** The product page's main shot is the largest paint on that route. */
  priority?: boolean;
  className?: string;
}) {
  if (!product.photo) {
    return <CapArt view={view.id as CapView} className={className} />;
  }

  const src = `/menu/${product.photo}.webp`;

  return (
    <div className={`cne-capshot is-photo ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
