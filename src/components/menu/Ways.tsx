import type { ReactElement } from "react";
import { ways, extras } from "@/data/menu";
import { formatPrice } from "@/lib/otter";

/**
 * The Ways are the best idea on the menu, so the choice belongs here rather
 * than buried in Otter's modifier list.
 *
 * Otter can't accept preselected modifiers through a link, so rather than make
 * someone pick toppings twice, each Way names the exact checkboxes that appear
 * on the Otter item screen. The decision happens on our page; the mechanical
 * part happens once, where it has to.
 */
export function Ways(): ReactElement {
  return (
    <section
      aria-labelledby="ways-h"
      style={{
        padding: "60px clamp(16px, 5vw, 60px) 0",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div className="cne-onscroll-up">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 2,
            color: "var(--color-cne-red)",
            textTransform: "uppercase",
          }}
        >
          Pick a way — free
        </div>
        <h2
          id="ways-h"
          className="cne-menu-h2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 7.5vw, 76px)",
            margin: "6px 0 0",
            letterSpacing: 1,
            color: "var(--color-cne-ink)",
            textShadow: "4px 4px 0 var(--color-cne-yellow)",
            lineHeight: 0.9,
          }}
        >
          THE WAYS
        </h2>
        <div style={{ height: 4, background: "var(--color-cne-ink)", marginTop: 14 }} />
      </div>

      <div className="cne-onscroll-stagger cne-ways-grid" style={{ display: "grid", gap: 20, marginTop: 24 }}>
        {ways.map((w) => (
          <article
            key={w.id}
            style={{
              border: "4px solid var(--color-cne-ink)",
              background: "var(--color-cne-paper)",
              boxShadow: "6px 6px 0 var(--color-cne-ink)",
              padding: "22px 24px",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 4.6vw, 30px)",
                letterSpacing: 1,
                margin: 0,
                color: "var(--color-cne-ink)",
                lineHeight: 1.05,
              }}
            >
              {w.name}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 15,
                color: "var(--color-cne-muted)",
                margin: "8px 0 0",
              }}
            >
              {w.summary}
            </p>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: "var(--color-cne-red)",
                margin: "18px 0 10px",
              }}
            >
              Tap these when you order
            </div>
            <ul
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {w.taps.map((t) => (
                <li
                  key={t}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 700,
                    background: "var(--color-cne-cream)",
                    border: "2px solid var(--color-cne-ink)",
                    padding: "6px 10px",
                    color: "var(--color-cne-ink)",
                  }}
                >
                  ☐ {t}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--color-cne-muted)",
          marginTop: 20,
          maxWidth: "68ch",
        }}
      >
        Every topping below is free. The only add-ons that cost anything are{" "}
        {extras.map((e, i) => (
          <span key={e.name}>
            {i > 0 && " and "}
            <strong style={{ color: "var(--color-cne-ink)" }}>
              {e.name.toLowerCase()} ({formatPrice(e.price)})
            </strong>
          </span>
        ))}
        .
      </p>

      <style>{`
        .cne-ways-grid { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 820px) { .cne-ways-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
