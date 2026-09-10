import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Chris N Eddy's — Smashed sliders in Hollywood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#E63027",
          color: "#FFF2C9",
          padding: "60px 80px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 6,
            color: "#F5B82E",
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          OPEN LATE
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 180,
            lineHeight: 0.92,
            letterSpacing: 2,
            fontWeight: 900,
          }}
        >
          <span>SLIDERS</span>
          <span style={{ color: "#F5B82E" }}>SO GOOD</span>
          <span>THEY HURT.</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 30,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <span>chrisneddys.com</span>
          <span>Hollywood · Glendale · Van Nuys</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
