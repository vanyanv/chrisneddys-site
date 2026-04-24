"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { MobileNavToggle } from "./MobileNavToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu/", label: "Menu" },
  { href: "/locations/", label: "Locations" },
  { href: "/about/", label: "Story" },
];

export function Nav(): ReactElement {
  const raw = usePathname() ?? "/";
  // Normalize: match trailing-slash setting so "/menu" and "/menu/" both highlight Menu.
  const activePath = raw === "/" ? "/" : raw.endsWith("/") ? raw : raw + "/";
  return (
    <header
      style={{
        background: "var(--color-cne-red)",
        color: "var(--color-cne-cream)",
        borderBottom: "4px solid var(--color-cne-ink)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px clamp(16px, 4vw, 36px)",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          aria-label={`${brand.name} — Home`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <Image
            src="/cne-logo.png"
            alt={brand.name}
            width={106}
            height={60}
            priority
            style={{
              height: 60,
              width: "auto",
              display: "block",
              filter: "drop-shadow(2px 3px 0 rgba(0,0,0,0.25))",
            }}
          />
        </Link>

        <nav
          aria-label="Primary"
          className="cne-desktop-nav"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          {links.map(({ href, label }) => {
            const active = activePath === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="cne-hover-grow"
                style={{
                  background: active ? "var(--color-cne-cream)" : "transparent",
                  color: active ? "var(--color-cne-red)" : "var(--color-cne-cream)",
                  border: `3px solid ${active ? "var(--color-cne-ink)" : "transparent"}`,
                  padding: "8px 18px",
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  textDecoration: "none",
                  boxShadow: active ? "3px 3px 0 var(--color-cne-ink)" : "none",
                  lineHeight: 1,
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="cne-desktop-cta">
          <a
            href={brand.orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cne-hover-grow"
            style={{
              background: "var(--color-cne-yellow)",
              color: "var(--color-cne-ink)",
              border: "3px solid var(--color-cne-ink)",
              padding: "10px 20px",
              fontFamily: "var(--font-display)",
              fontSize: 14,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow: "4px 4px 0 var(--color-cne-ink)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Order on Otter →
          </a>
        </div>

        <div className="cne-mobile-nav">
          <MobileNavToggle activePath={activePath} />
        </div>
      </div>

      {/* Responsive toggle */}
      <style>{`
        .cne-mobile-nav { display: none; }
        @media (max-width: 900px) {
          .cne-desktop-nav, .cne-desktop-cta { display: none !important; }
          .cne-mobile-nav { display: inline-flex; }
        }
      `}</style>
    </header>
  );
}
