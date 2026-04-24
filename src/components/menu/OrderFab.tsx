"use client";

import { useEffect, useState, type ReactElement } from "react";
import { brand } from "@/data/brand";

export function OrderFab(): ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 160);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
      <a
        href={brand.orderUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Order online"
        className="cne-hover-grow cne-order-fab"
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          zIndex: 40,
          background: "var(--color-cne-red)",
          color: "var(--color-cne-cream)",
          border: "3px solid var(--color-cne-ink)",
          boxShadow: "4px 4px 0 var(--color-cne-ink)",
          padding: "12px 18px",
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          textDecoration: "none",
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "translateY(16px) scale(0.95)",
          pointerEvents: visible ? "auto" : "none",
          transition:
            "opacity .25s ease, transform .25s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        Order online →
      </a>
      <style>{`
        @media (max-width: 600px) {
          .cne-order-fab {
            padding: 14px 20px !important;
            font-size: 14px !important;
            right: 12px !important;
            bottom: calc(12px + env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>
    </>
  );
}
