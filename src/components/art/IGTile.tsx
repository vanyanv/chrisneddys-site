import type { ReactElement } from "react";
import { FoodShot, type FoodTone, type FoodVariant } from "./FoodShot";

const variants: FoodVariant[] = [
  "double",
  "fries",
  "tots",
  "shake",
  "parking",
  "neon",
  "double",
  "fries",
  "tots",
];

// Deterministic "like counts" so SSR output equals client output.
const LIKE_COUNTS = [842, 617, 1204, 389, 923, 476, 1058, 524, 735];

export function IGTile({
  idx = 0,
  tone = "warm",
}: {
  idx?: number;
  tone?: FoodTone;
}): ReactElement {
  const variant = variants[idx % variants.length];
  const likes = LIKE_COUNTS[idx % LIKE_COUNTS.length];
  return (
    <div style={{ position: "relative", aspectRatio: "1/1", overflow: "hidden", background: "#1a0a05" }}>
      <FoodShot variant={variant} tone={tone} idSeed={`ig-${idx}`} />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 10,
          color: "#fff",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1.5,
          opacity: 0.85,
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        ♡ {likes}
      </div>
    </div>
  );
}
