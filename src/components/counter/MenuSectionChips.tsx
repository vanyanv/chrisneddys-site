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
/** How far under the chip bar a heading may sit and still count as the
 * section you're in. More than the 10px a tap leaves it at. */
const SLACK = 24;

export function MenuSectionChips({
  sections,
}: {
  sections: { key: MenuCategoryKey; label: string }[];
}) {
  const barRef = useRef<HTMLElement | null>(null);
  const chipRefs = useRef<Partial<Record<MenuCategoryKey, HTMLAnchorElement>>>({});
  const [active, setActive] = useState<MenuCategoryKey | undefined>(sections[0]?.key);

  /* The section a tap asked for, held until the page stops scrolling. The
     smooth scroll passes every section in between, and without this the
     chip strip flickers through each of them on the way. */
  const heldRef = useRef<MenuCategoryKey | null>(null);

  useEffect(() => {
    const ids = sections.map((s) => s.key);
    const els = ids
      .map((key) => document.getElementById(`menu-${key}`))
      .filter((el): el is HTMLElement => Boolean(el));
    const bar = barRef.current;
    if (!bar || els.length === 0) return;

    const pick = () => {
      // A heading counts as "current" once it is within SLACK of the bar's
      // bottom edge. A tap parks the heading 10px under the bar, and a line
      // at the bar itself left every tapped section one short of counting,
      // so the chip above it stayed lit (issue #257).
      const line = bar.getBoundingClientRect().bottom + SLACK;
      // At the very bottom the last section can't scroll up to the line —
      // Drinks is shorter than the screen — so the bottom of the page is it.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = els[0]!.id.replace("menu-", "");
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.id.replace("menu-", "");
      }
      if (atBottom) current = els[els.length - 1]!.id.replace("menu-", "");
      setActive(current as MenuCategoryKey);
    };

    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (heldRef.current) {
        // Release the tapped chip once the scroll has settled, then let the
        // page decide, which by then agrees with it.
        clearTimeout(idle);
        idle = setTimeout(() => {
          heldRef.current = null;
          pick();
        }, 150);
        return;
      }
      pick();
    };

    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      clearTimeout(idle);
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
    const bar = barRef.current;
    if (!chip || !bar) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Scroll the strip itself, not `chip.scrollIntoView()`: that also counts
    // as scrolling the page, and starting it mid-jump cut a tap on Drinks
    // short of the Drinks heading (issue #257).
    bar.scrollTo({
      left: chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2,
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
    // Where the bar's bottom edge will be once it is stuck, not where it is
    // now: tapped from the top of the page the bar hasn't stuck yet, and its
    // current position sent Drinks 92px short (issue #257).
    const offset = parseFloat(getComputedStyle(bar).top) + bar.offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - offset - 10;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // No scroll is coming when the page is already there, so nothing to hold.
    const reachable = Math.max(
      0,
      Math.min(top, document.documentElement.scrollHeight - window.innerHeight),
    );
    if (Math.abs(reachable - window.scrollY) > 2) {
      heldRef.current = key;
      // A backstop in case no scroll event ever comes to release it.
      setTimeout(() => {
        if (heldRef.current === key) heldRef.current = null;
      }, 1500);
    }
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
