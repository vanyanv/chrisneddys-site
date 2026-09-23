"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuCategoryKey } from "@/data/menu";

/**
 * The phone-only jump strip: a sticky row of section chips just under the
 * sticky header, one per menu section, that scrolls to a section on tap and
 * highlights whichever one is current as the page scrolls.
 *
 * Desktop keeps the existing `.cne-menu-jump` side list untouched — this is
 * hidden from 901px up by `.cne-menu-chipnav`'s own media query in
 * `menu-art.css`, so it costs nothing to always render both.
 *
 * The "current" line is this bar's own bottom edge rather than a fixed
 * offset: the sticky header's height changes across breakpoints (the tab
 * strip folds away above 901px, the short-landscape rule shrinks it further),
 * and reading the bar's real position keeps this correct everywhere without
 * having to know any of those numbers.
 */
export function MenuSectionChips({
  sections,
}: {
  sections: { key: MenuCategoryKey; label: string }[];
}) {
  const barRef = useRef<HTMLElement | null>(null);
  const chipRefs = useRef<Partial<Record<MenuCategoryKey, HTMLAnchorElement>>>({});
  const [active, setActive] = useState<MenuCategoryKey | undefined>(sections[0]?.key);

  useEffect(() => {
    const ids = sections.map((s) => s.key);
    const els = ids
      .map((key) => document.getElementById(`menu-${key}`))
      .filter((el): el is HTMLElement => Boolean(el));
    const bar = barRef.current;
    if (!bar || els.length === 0) return;

    const onScroll = () => {
      // The bar's own bottom edge is the line a section's heading has to clear
      // to count as "current" — it is exactly where the sticky bar stops and
      // the page's own content starts, at whatever height that is right now.
      const line = bar.getBoundingClientRect().bottom;
      let current = els[0]!.id.replace("menu-", "");
      for (const el of els) {
        if (el.getBoundingClientRect().top - line <= 0) current = el.id.replace("menu-", "");
      }
      setActive(current as MenuCategoryKey);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // `sections` is a fresh array every render from the caller, but its keys
    // never change at runtime — the menu's categories are build-time data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep the highlighted chip on screen as the active section changes —
    // the strip scrolls sideways, so the current chip can drift off either
    // edge as you read down the page.
    const chip = active ? chipRefs.current[active] : undefined;
    if (!chip) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chip.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [active]);

  const onChipClick = (key: MenuCategoryKey) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(`menu-${key}`);
    const bar = barRef.current;
    if (!target || !bar) return;
    e.preventDefault();
    // Land the section's heading just under this bar, not under it — a plain
    // hash jump only clears the sticky *header* (see `scroll-padding-top` in
    // counter.css), which is what this bar sits below and would otherwise
    // cover the heading it just jumped to.
    const offset = bar.getBoundingClientRect().bottom;
    const top = target.getBoundingClientRect().top + window.scrollY - offset - 10;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    setActive(key);
  };

  return (
    <nav className="cne-menu-chipnav" aria-label="Jump to a menu section" ref={barRef}>
      {sections.map(({ key, label }) => (
        <a
          key={key}
          ref={(el) => {
            if (el) chipRefs.current[key] = el;
          }}
          href={`#menu-${key}`}
          className={`cne-menu-chip${active === key ? " is-active" : ""}`}
          aria-current={active === key ? "true" : undefined}
          onClick={onChipClick(key)}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
