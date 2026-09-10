"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { orderUrl } from "@/lib/otter";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu/", label: "Menu" },
  { href: "/locations/", label: "Locations" },
  { href: "/about/", label: "Story" },
];

export function MobileNavToggle({ activePath }: { activePath: string }) {
  const [open, setOpen] = useState(false);

  // Close on Escape or when resizing above breakpoint
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 5,
          width: 44,
          height: 44,
          background: "transparent",
          border: "3px solid var(--color-cne-ink)",
          color: "var(--color-cne-cream)",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <span style={{ width: 22, height: 3, background: "currentColor" }} />
        <span style={{ width: 22, height: 3, background: "currentColor" }} />
        <span style={{ width: 22, height: 3, background: "currentColor" }} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "var(--color-cne-ink)",
            color: "var(--color-cne-cream)",
            display: "flex",
            flexDirection: "column",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                width: 44,
                height: 44,
                background: "transparent",
                border: "3px solid var(--color-cne-cream)",
                color: "var(--color-cne-cream)",
                fontSize: 24,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <nav
            aria-label="Mobile primary"
            style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 18 }}
          >
            {links.map((l) => {
              const active = activePath === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 40,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: active ? "var(--color-cne-yellow)" : "var(--color-cne-cream)",
                    textDecoration: "none",
                    lineHeight: 1,
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <a
            href={orderUrl("nav")}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 36,
              alignSelf: "flex-start",
              background: "var(--color-cne-yellow)",
              color: "var(--color-cne-ink)",
              padding: "14px 24px",
              border: "3px solid var(--color-cne-cream)",
              boxShadow: "5px 5px 0 var(--color-cne-red)",
              fontFamily: "var(--font-display)",
              fontSize: 18,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Order online →
          </a>
        </div>
      )}
    </>
  );
}
