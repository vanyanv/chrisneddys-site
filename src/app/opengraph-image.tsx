import { ImageResponse } from "next/og";
import { brand } from "@/data/brand";

/**
 * The sitewide default share card — what a link to the home page (or any page
 * that hasn't set its own `openGraph.images`) previews as. Generated instead
 * of the old static `public/og.jpg` so the mascot art has one source of truth
 * with the favicon in `icon.tsx`, which this reuses the same red/cream/blue
 * monster-face building blocks from (just bigger, and paired with a wordmark).
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

const INK = "#14110d";
const BODY = "#e63027";
const PAPER = "#fff8e7";
const IRIS = "#2e5fd9";

/** A bigger version of the eye-over-mouth face `icon.tsx` draws, directly on
 * the red body circle — matching how `MascotDefs`' `#cne-classic` `<symbol>`
 * layers them, rather than nesting a second face-coloured disc inside the
 * body the way an earlier draft of this file did. */
function MonsterFace() {
  return (
    <div
      style={{
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: BODY,
        border: `12px solid ${INK}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: PAPER,
          border: `8px solid ${INK}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: "50%",
            background: IRIS,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{ width: 28, height: 28, borderRadius: "50%", background: INK, display: "flex" }}
          />
        </div>
      </div>
      <div
        style={{
          width: 104,
          height: 48,
          marginTop: 22,
          borderRadius: "0 0 48px 48px",
          background: INK,
          display: "flex",
        }}
      />
    </div>
  );
}

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
      <MonsterFace />
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
