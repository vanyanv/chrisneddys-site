import type { ImgHTMLAttributes } from "react";

/**
 * A menu photograph at thumbnail or full size, AVIF first (issue #208).
 *
 * The AVIF cuts (`<photo>-thumb.avif`, `<photo>.avif`, from
 * `scripts/build-menu-cards.mjs`) are about half the WebP's bytes; the WebP
 * stays as the `<img>` for browsers without AVIF. The `<picture>` is
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
      <source
        type="image/avif"
        srcSet={`/menu/${photo}-thumb.avif 200w, /menu/${photo}.avif 720w`}
        sizes={sizes}
      />
      <img
        src={`/menu/${photo}.webp`}
        srcSet={`/menu/${photo}-thumb.webp 200w, /menu/${photo}.webp 720w`}
        sizes={sizes}
        width={720}
        height={479}
        alt={alt}
        {...img}
      />
    </picture>
  );
}
