"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import Link from "next/link";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";

const RED = { bodyColor: MONSTER_COLORS.red.body, irisColor: MONSTER_COLORS.red.iris };
const YELLOW = { bodyColor: MONSTER_COLORS.yellow.body, irisColor: MONSTER_COLORS.yellow.iris };
import { brand } from "@/data/brand";
import { flagship } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { ways } from "@/data/menu";
import { press } from "@/data/press";
import { orderUrl } from "@/lib/otter";

/** A `<svg style>` that also carries the nine-grid's stamp-in stagger index. */
type NineStyle = CSSProperties & { "--i"?: number };

const [chris, eddy] = ways;
const ktla = press.find((p) => p.pub === "KTLA 5");
const eaterLa = press.find((p) => p.pub === "Eater LA");

/**
 * "The Drip" — a red paint line runs down the middle of the timeline and
 * grows as the page scrolls, ending in a puddle. Approved from a mockup
 * (issue #97); see `src/styles/about.css` for the sizing scale it runs on.
 *
 * Every bit of copy here renders on the server — the two effects this file
 * owns are additions once JS runs, never requirements to see the content:
 *
 * 1. The drip's height and the teardrop riding its tip track scroll
 *    position, via one passive, rAF-throttled `scroll` listener that writes
 *    a `--p` (and `--py`) custom property `about.css` reads.
 * 2. Each chapter fades and settles into place the first time it crosses
 *    into view, via one `IntersectionObserver`. The `armed` class that makes
 *    that possible is only added here, after mount — so with JS off, or
 *    before it runs, every chapter is already fully visible.
 *
 * Neither runs, and the drip renders at full height with the teardrop
 * hidden, when the visitor's OS asks for reduced motion.
 */
export function DripStory(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tl = root.querySelector<HTMLElement>(".cne-drip-tl");
    const drop = root.querySelector<HTMLElement>(".cne-drip-drop");

    if (reduce || !tl) return;

    drop?.classList.add("is-on");

    let raf = 0;
    const update = () => {
      const rect = tl.getBoundingClientRect();
      const height = tl.offsetHeight || 1;
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.6 - rect.top) / height));
      tl.style.setProperty("--p", p.toFixed(4));
      drop?.style.setProperty("--py", `${(p * height).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();

    root.classList.add("cne-drip-armed");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("cne-drip-in");
        });
      },
      { threshold: 0.22 },
    );
    root.querySelectorAll(".cne-drip-rv").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const hollywoodHref = `/locations/${slugFor(flagship)}/`;

  return (
    <div className="cne-drip" ref={rootRef}>
      <div className="cne-drip-top">
        <span className="cne-drip-tagl">our story</span>
        <h1>IT STARTED WITH A PHONE CALL.</h1>
        <p>
          Two best friends, one argument about a burger, and a line of red paint from{" "}
          {brand.founded} to now.
        </p>
      </div>

      <div className="cne-drip-tl">
        <div className="cne-drip-line" aria-hidden="true" />
        <div className="cne-drip-drop" aria-hidden="true">
          <svg viewBox="0 0 40 60">
            <path
              d="M20,2 C28,20 34,32 34,42 A14,14 0 1 1 6,42 C6,32 12,20 20,2 Z"
              fill="#e63027"
            />
          </svg>
        </div>

        <div className="cne-drip-st cne-drip-rv">
          <i className="cne-drip-dot" aria-hidden="true" />
          <div className="cne-drip-txt">
            <span className="cne-drip-yr">age 13</span>
            <h3>BEST FRIENDS FIRST</h3>
            <p>
              Chris and Eddy met when they were about thirteen, and they&rsquo;ve been arguing ever
              since.
            </p>
          </div>
          <div className="cne-drip-med">
            <div className="cne-drip-pair">
              <span className="cne-drip-pair-mon">
                <Monster species="classic" {...RED} size={200} />
              </span>
              <span className="cne-drip-pair-mon">
                <Monster species="classic" {...YELLOW} size={200} />
              </span>
            </div>
          </div>
        </div>

        <div className="cne-drip-st is-flip cne-drip-rv">
          <i className="cne-drip-dot" aria-hidden="true" />
          <div className="cne-drip-txt">
            <span className="cne-drip-yr">spring 2020</span>
            <h3>THE CALL</h3>
            <p>
              Eddy called Chris with an idea. Chris was in San Francisco. He packed up that week.
            </p>
          </div>
          <div className="cne-drip-med">
            <span className="cne-drip-ring">
              RING
              <br />
              RING!
            </span>
          </div>
        </div>

        <div className="cne-drip-st cne-drip-rv">
          <i className="cne-drip-dot" aria-hidden="true" />
          <div className="cne-drip-txt">
            <span className="cne-drip-yr">9 months</span>
            <h3>A TASTING A DAY</h3>
            <p>
              Two patties, smashed thin, on two slices of American and a buttered Martin&rsquo;s
              roll. Nothing has changed it since.
            </p>
          </div>
          <div className="cne-drip-med">
            <div className="cne-drip-nine">
              {Array.from({ length: 9 }, (_, i) => (
                <svg
                  key={i}
                  style={{ "--i": i } as NineStyle}
                  viewBox="0 0 40 32"
                  aria-hidden="true"
                >
                  <path
                    d="M4 16 Q4 3 20 3 Q36 3 36 16 Z"
                    fill="#f5b82e"
                    stroke="#1a1612"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M3 16 H37 L33 21 L28 18 L22 22 L16 18 L10 21 L6 18 Z"
                    fill="#ffd633"
                    stroke="#1a1612"
                    strokeWidth="2"
                  />
                  <rect x="4" y="19" width="32" height="5" rx="2" fill="#1a1612" />
                  <path
                    d="M5 24 H35 V27 Q35 30 31 30 H9 Q5 30 5 27 Z"
                    fill="#f5b82e"
                    stroke="#1a1612"
                    strokeWidth="2.2"
                  />
                </svg>
              ))}
            </div>
          </div>
        </div>

        <div className="cne-drip-st is-flip cne-drip-rv">
          <i className="cne-drip-dot" aria-hidden="true" />
          <div className="cne-drip-txt">
            <span className="cne-drip-yr">late {brand.founded}</span>
            <h3>THE PARKING LOT</h3>
            <p>The first sliders went out of a pop-up in a Hollywood parking lot.</p>
          </div>
          <div className="cne-drip-med">
            <figure className="cne-drip-tp" style={{ "--r": "3deg" } as CSSProperties}>
              <img
                src="/photos/ig-pile.webp"
                srcSet="/photos/ig-pile-sm.webp 300w, /photos/ig-pile.webp 500w"
                sizes="(min-width: 1440px) 245px, (min-width: 700px) 17vw, 46vw"
                alt="A pile of Chris N Eddy’s smash sliders"
                width={500}
                height={625}
                loading="lazy"
                decoding="async"
              />
              <figcaption>THE FIRST SLIDERS</figcaption>
            </figure>
          </div>
        </div>

        <div className="cne-drip-st cne-drip-rv">
          <i className="cne-drip-dot" aria-hidden="true" />
          <div className="cne-drip-txt">
            <span className="cne-drip-yr">2021</span>
            <h3>SUNSET BLVD</h3>
            <p>The flagship opens at {flagship.address}, and the monsters move onto the walls.</p>
          </div>
          <div className="cne-drip-med">
            <figure className="cne-drip-tp" style={{ "--r": "-4deg" } as CSSProperties}>
              <img
                src="/photos/ig-monster.webp"
                srcSet="/photos/ig-monster-sm.webp 300w, /photos/ig-monster.webp 500w"
                sizes="(min-width: 1440px) 245px, (min-width: 700px) 17vw, 46vw"
                alt="Stacked sliders in front of Chris N Eddy’s monster mural"
                width={500}
                height={500}
                loading="lazy"
                decoding="async"
              />
              <figcaption>5539 W. SUNSET BLVD</figcaption>
            </figure>
          </div>
        </div>

        {ktla ? (
          <div className="cne-drip-st is-flip cne-drip-rv">
            <i className="cne-drip-dot" aria-hidden="true" />
            <div className="cne-drip-txt">
              <span className="cne-drip-yr">2023</span>
              <h3>ON THE ROAD</h3>
              <p>About {brand.festivalsPerYear} festival dates a year.</p>
            </div>
            <div className="cne-drip-med">
              <div className="cne-drip-qstk" style={{ "--r": "-2deg" } as CSSProperties}>
                <blockquote>&ldquo;{ktla.quote}&rdquo;</blockquote>
                <cite>{ktla.pub.toUpperCase()}</cite>
              </div>
            </div>
          </div>
        ) : null}

        {eaterLa ? (
          <div className="cne-drip-st cne-drip-rv">
            <i className="cne-drip-dot" aria-hidden="true" />
            <div className="cne-drip-txt">
              <span className="cne-drip-yr">next</span>
              <h3>GLENDALE + VAN NUYS</h3>
              <p>Two more locations on the way.</p>
            </div>
            <div className="cne-drip-med">
              <div className="cne-drip-qstk is-wide" style={{ "--r": "2deg" } as CSSProperties}>
                <blockquote>&ldquo;{eaterLa.quote}&rdquo;</blockquote>
                <cite>{eaterLa.pub.toUpperCase()}</cite>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="cne-drip-pool">
        <svg
          className="cne-drip-pool-lip"
          viewBox="0 0 400 30"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,30 V18 C30,10 50,22 80,16 C110,10 130,20 160,14 C180,10 190,2 200,0 C210,2 220,10 240,14 C270,20 290,10 320,16 C350,22 370,10 400,18 V30 Z"
            fill="var(--a-red-cta)"
          />
        </svg>
        <h2>WHOSE SIDE ARE YOU ON?</h2>
        <p>
          They never settled it, so both Ways went on the menu. Pick one and the menu opens with it
          already selected.
        </p>
        <div className="cne-drip-cta">
          <Link prefetch={false} className="cne-drip-btn is-sec" href={`/menu/?way=${chris.id}`}>
            {chris.name.toUpperCase()} &rarr;
          </Link>
          <Link prefetch={false} className="cne-drip-btn is-pri" href={`/menu/?way=${eddy.id}`}>
            {eddy.name.toUpperCase()} &rarr;
          </Link>
        </div>
        <p className="cne-drip-quiet" data-surface="about">
          <a href={orderUrl("about")} target="_blank" rel="noopener noreferrer">
            ORDER ONLINE
          </a>
          <span aria-hidden="true">&middot;</span>
          <Link prefetch={false} href={hollywoodHref}>
            {flagship.address}
          </Link>
        </p>
      </div>
    </div>
  );
}
