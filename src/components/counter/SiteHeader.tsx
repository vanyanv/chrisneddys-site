"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/data/brand";
import { storeUrl } from "@/lib/otter";
import { OpenStatus } from "@/components/shared/OpenStatus";

const TABS = [
  { href: "/", label: "HOME" },
  { href: "/menu/", label: "MENU" },
  { href: "/locations/", label: "LOCATIONS" },
];

/**
 * Red header with the live status pill and a three-tab bar.
 *
 * On a phone the tab bar is its own band under the logo row; on desktop the two
 * collapse into a single 76px row. That's one DOM either way — `.cne-nav` goes
 * `display: contents` at the desktop breakpoint so the logo, tabs and right-hand
 * group become siblings in the header's flex row, reordered with `order`.
 */
export function SiteHeader() {
  const raw = usePathname() ?? "/";
  const path = raw === "/" ? "/" : raw.endsWith("/") ? raw : `${raw}/`;
  const activeIndex = TABS.findIndex((t) => t.href === path);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`cne-header${lifted ? " is-lifted" : ""}`}>
      <div className="cne-nav">
        <Link href="/" aria-label={`${brand.name} — Home`} className="cne-logo">
          <Image src="/cne-logo.webp" alt={brand.name} width={155} height={88} priority />
        </Link>
        <div className="cne-nav-right">
          <OpenStatus />
          <a className="cne-orderbtn" href={storeUrl} target="_blank" rel="noopener noreferrer">
            ORDER<span className="cne-only-desk-i"> ONLINE →</span>
          </a>
        </div>
      </div>

      <nav className="cne-tabs" aria-label="Primary">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="cne-tab"
            aria-current={t.href === path ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
        {activeIndex >= 0 && (
          /* The slide is `--cne-tab-i` tabs wide, and only the stylesheet knows
             how wide a tab and the bar itself are — so it does the arithmetic.
             Passing a percentage from here would have to hardcode the bar's
             own width and drift the moment either changes. */
          <span
            className="cne-tabind"
            aria-hidden="true"
            style={
              {
                "--cne-tab-i": activeIndex,
                "--cne-tab-n": TABS.length,
              } as CSSProperties
            }
          />
        )}
      </nav>
    </header>
  );
}
