import { ImageResponse } from "next/og";

/**
 * The browser-tab favicon, generated instead of shipped as a static file so
 * there is one source of truth for "what the monster looks like" instead of a
 * hand-exported PNG that can drift from the mural set's colours.
 *
 * A simplified `<div>`-based build of the "classic" monster `MascotDefs`
 * draws as an SVG `<symbol>` (`#cne-classic`): same red body, cream eye, blue
 * iris, black pupil and dark mouth, at a scale too small for the real
 * artwork's teeth and outline weight to read as anything but noise. This
 * doesn't share code with `MascotDefs` because Satori (the renderer behind
 * `ImageResponse`) doesn't support arbitrary SVG markup, only a constrained
 * subset of flexbox-and-friends `<div>` styles.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INK = "#14110d";
const BODY = "#e63027";
const EYE_WHITE = "#fff8e7";
const IRIS = "#2e5fd9";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: BODY,
        borderRadius: "50%",
        border: `2px solid ${INK}`,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: EYE_WHITE,
          border: `1.5px solid ${INK}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: IRIS,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{ width: 3, height: 3, borderRadius: "50%", background: INK, display: "flex" }}
          />
        </div>
      </div>
      <div
        style={{
          width: 13,
          height: 6,
          marginTop: 3,
          borderRadius: "0 0 6px 6px",
          background: INK,
          display: "flex",
        }}
      />
    </div>,
    { ...size },
  );
}
