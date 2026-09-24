/**
 * One of the owner's photos of the Hollywood location or Slider's murals, as
 * cut by `scripts/build-art-photos.mjs`: AVIF and WebP at each of `widths`,
 * plus a JPEG fallback. `width`/`height` give the crop's aspect ratio so the
 * box is reserved before the image arrives.
 */
export function ArtPhoto({
  name,
  widths,
  width,
  height,
  sizes,
  alt,
  priority = false,
  phoneWidths,
}: {
  name: string;
  widths: number[];
  width: number;
  height: number;
  sizes: string;
  alt: string;
  /** The page's LCP image: fetched eagerly and first. Everything else is lazy. */
  priority?: boolean;
  /**
   * A shorter ladder for screens up to 600px wide. A 3x phone asks for three
   * times its CSS width, which for a full-bleed photo is the biggest cut;
   * capping it here trades pixels the phone barely shows for a faster LCP.
   */
  phoneWidths?: number[];
}) {
  const set = (ext: string, ws = widths) =>
    ws.map((w) => `/photos/art/${name}-${w}.${ext} ${w}w`).join(", ");
  return (
    <picture>
      {phoneWidths && (
        <source
          media="(max-width: 600px)"
          type="image/avif"
          srcSet={set("avif", phoneWidths)}
          sizes="100vw"
        />
      )}
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      <img
        src={`/photos/art/${name}.jpg`}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
      />
    </picture>
  );
}
