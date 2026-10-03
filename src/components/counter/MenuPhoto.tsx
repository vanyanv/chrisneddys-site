import type { ImgHTMLAttributes } from "react";
import { menuPhotoSrcSet } from "@/lib/menuPhoto";

/**
 * A menu photograph in its 3:2 frame, AVIF first (issue #208), at every size
 * `scripts/build-menu-cards.mjs` cut it (issue #237): 200px for a phone's
 * small square up to 1280px for a 3x phone drawing it full width.
 *
 * The WebP stays as the `<img>` for browsers without AVIF. The `<picture>` is
 * `display: contents`, so every style that targets the `<img>` still lays it
 * out exactly as before.
 */
export function MenuPhoto({
  photo,
  sizes,
  alt,
  ...img
}: { photo: string; sizes: string; alt: string } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt"
>) {
  return (
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={menuPhotoSrcSet(photo, "avif")} sizes={sizes} />
      <img
        src={`/menu/${photo}.webp`}
        srcSet={menuPhotoSrcSet(photo, "webp")}
        sizes={sizes}
        width={720}
        height={480}
        alt={alt}
        {...img}
      />
    </picture>
  );
}
