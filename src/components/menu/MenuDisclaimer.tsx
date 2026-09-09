import type { ReactElement } from "react";
import { brand } from "@/data/brand";

/**
 * The prices on this page are the live Hollywood pickup prices. This says so,
 * and says the thing worth knowing: ordering direct is cheaper than the
 * delivery apps.
 */
export function MenuDisclaimer(): ReactElement {
  return (
    <section
      aria-label="About our menu"
      style={{
        padding: "40px clamp(16px, 5vw, 60px) 0",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="cne-menu-disclaimer-box"
        style={{
          background: "var(--color-cne-ink)",
          color: "var(--color-cne-cream)",
          border: "4px solid var(--color-cne-ink)",
          boxShadow: "6px 6px 0 var(--color-cne-red)",
          padding: "26px 28px",
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: "1 1 320px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--color-cne-yellow)",
            }}
          >
            GOOD TO KNOW
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 3vw, 30px)",
              letterSpacing: 0.5,
              lineHeight: 1.1,
              marginTop: 6,
            }}
          >
            These are pickup prices. Delivery apps charge more.
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              opacity: 0.8,
              marginTop: 8,
              maxWidth: 640,
              lineHeight: 1.5,
            }}
          >
            Every price here comes straight from our own ordering page, and
            ordering there sends the whole thing to us. Sold-out items show as
            unavailable at checkout.
          </div>
        </div>
        <a
          href={brand.orderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cne-hover-grow"
          style={{
            background: "var(--color-cne-yellow)",
            color: "var(--color-cne-ink)",
            border: "3px solid var(--color-cne-cream)",
            padding: "14px 24px",
            fontFamily: "var(--font-display)",
            fontSize: 16,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: "5px 5px 0 var(--color-cne-red)",
            whiteSpace: "nowrap",
          }}
        >
          Order online →
        </a>
      </div>
      <style>{`
        @media (max-width: 600px) {
          .cne-menu-disclaimer-box { padding: 20px 20px !important; }
        }
      `}</style>
    </section>
  );
}
