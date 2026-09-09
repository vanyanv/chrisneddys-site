"use client";

import Link from "next/link";
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
          <span
            className="cne-tabind"
            aria-hidden="true"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
      </nav>
    </header>
  );
}
