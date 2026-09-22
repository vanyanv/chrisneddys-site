import { ImageResponse } from "next/og";
import { brand } from "@/data/brand";
import { MONSTER_ICON_DATA_URI } from "@/lib/monsterIcon";

/**
 * The sitewide default share card — what a link to the home page (or any page
 * that hasn't set its own `openGraph.images`) previews as. Generated instead
 * of the old static `public/og.jpg`. The monster is the same grinning blue one
 * as the browser-tab icon (`src/lib/monsterIcon.ts`), just bigger and paired
 * with a wordmark.
 *
 * Per-product pages draw their own card at `shop/[product]/social-card` and
 * are untouched by this file — see that route's own comment for why a plain
 * route handler, not this convention, is what they use.
 *
 * No webfont is loaded: Bowlby One would mean fetching font binary data on
 * every render for a fallback image that has to be dependable first and
 * on-brand second. The bold system-sans stack below carries the wordmark
 * instead, matching the reasoning already written down in the per-product
 * card route.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BODY = "#e63027";
const PAPER = "#fff8e7";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: BODY,
        padding: "0 90px",
        gap: 64,
      }}
    >
      <img src={MONSTER_ICON_DATA_URI} width={320} height={320} alt="" />
      {/* `flex: 1` gives this a bounded width (the space left after the face
            and the side padding) so Satori can wrap the wordmark instead of
            running it off the canvas — the brand name is short enough to sit
            on one line at this size, but this stays safe if it isn't. */}
      <div
        style={{
          display: "flex",
          flex: 1,
          fontSize: 80,
          fontWeight: 800,
          lineHeight: 1.08,
          color: PAPER,
          fontFamily: "sans-serif",
        }}
      >
        {brand.name}
      </div>
    </div>,
    { ...size },
  );
}
