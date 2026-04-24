import type { ReactElement } from "react";
import { brand } from "@/data/brand";

export function OrderStrip(): ReactElement {
  return (
    <div
      role="complementary"
      style={{
        background: "var(--color-cne-yellow)",
        padding: "20px clamp(20px, 5vw, 60px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        borderBottom: "4px solid var(--color-cne-ink)",
        position: "sticky",
        top: 88,
        zIndex: 20,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(16px, 2.5vw, 22px)",
          color: "var(--color-cne-ink)",
          letterSpacing: 1,
        }}
      >
        Hungry yet? Pickup or delivery →
      </div>
      <a
        href={brand.orderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cne-hover-grow"
        style={{
          background: "var(--color-cne-red)",
          color: "var(--color-cne-cream)",
          padding: "12px 22px",
          fontFamily: "var(--font-display)",
          fontSize: 14,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          textDecoration: "none",
          border: "3px solid var(--color-cne-ink)",
          boxShadow: "4px 4px 0 var(--color-cne-ink)",
        }}
      >
        Order on Otter →
      </a>
    </div>
  );
}
