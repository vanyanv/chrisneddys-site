"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/data/brand";
import { orderUrl } from "@/lib/otter";
import { OpenStatus } from "@/components/shared/OpenStatus";
import { BagButton } from "@/components/shop/BagButton";
import { BiteTeeth } from "@/components/storeart/BiteTeeth";

/**
 * The six primary destinations. Exported because `PrefetchNav` warms exactly
 * this set once the page is idle — one list, so the thing that is prefetched
 * and the thing that is shown cannot drift apart.
 */
export const TABS = [
  { href: "/", label: "HOME" },
  { href: "/menu/", label: "MENU" },
  { href: "/locations/", label: "LOCATIONS" },
  { href: "/shop/", label: "SHOP" },
  { href: "/about/", label: "OUR STORY" },
  { href: "/contact/", label: "CONTACT" },
];

/**
 * Red header with the live status pill and a six-tab bar.
 *
 * On a phone the tab bar is its own band under the logo row; on desktop the two
 * collapse into a single 76px row. That's one DOM either way — `.cne-nav` goes
 * `display: contents` at the desktop breakpoint so the logo, tabs and right-hand
 * group become siblings in the header's flex row, reordered with `order`.
 *
 * The wordmark is centred at both sizes and takes no part in that flex row: it
 * is positioned against the header instead, so it sits on the true centre
 * rather than being pushed off it by whatever the pill currently reads.
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
        <Link prefetch={false} href="/" aria-label={`${brand.name} — Home`} className="cne-logo">
          <Image src="/cne-logo-2x.webp" alt={brand.name} width={309} height={87} priority />
        </Link>
        <div className="cne-nav-right">
          <OpenStatus head />
          {/* The bag is additive: it renders nothing at all until there is
              something in it, and it never replaces ORDER ONLINE — that button
              is the food business's front door and it points at Otter. A nav
              control that means different things on different pages is one
              people stop trusting. */}
          <BagButton />
          <a
            className="cne-orderbtn"
            data-surface="header"
            href={orderUrl("header")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BiteTeeth position="top" />
            ORDER<span className="cne-only-desk-i"> ONLINE →</span>
            <BiteTeeth position="bottom" />
          </a>
        </div>
      </div>

      {/* `prefetch={false}` here and on every other storefront link. Next's
          default prefetches a link's whole route payload the moment the link
          enters the viewport, and these six are in the viewport on every page,
          so landing anywhere pulled ~29 KB apiece for five pages the visitor
          had not asked for — 143 KB before they had done anything, during the
          window the hero image is competing for. Reading a page to the bottom
          cost more again as the footer, the location cards and the menu's
          thirty item links scrolled past: 344 KB on the home page, 518 KB on
          the menu.

          It is a trade, and it was made deliberately. Prefetching bought a
          click-to-paint of 93ms on any connection; fetching on the click
          instead costs a median 224ms on 4G and 511ms on a fast-3G phone.
          So this spends about a tenth of a second on 4G, on the taps a
          visitor actually makes, to stop spending a third to half a megabyte
          on every page whether they tap or not. If that ever reads as slow,
          the narrowest way back is to drop `prefetch={false}` from these six
          tabs alone: it restores instant primary navigation for 143 KB a
          session, and leaves the footer, the location cards and the menu's
          item links — the ones that scale with how far the page is read —
          still off. */}
      <nav className="cne-tabs" aria-label="Primary">
        {TABS.map((t) => (
          <Link
            prefetch={false}
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
