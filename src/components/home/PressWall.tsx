import type { ReactElement } from "react";
import { press } from "@/data/press";

export function PressWall(): ReactElement {
  return (
    <section
      aria-labelledby="press-h"
      style={{
        background: "var(--color-cne-yellow)",
        padding: "60px clamp(20px, 5vw, 60px)",
        borderBottom: "4px solid var(--color-cne-ink)",
        borderTop: "4px solid var(--color-cne-ink)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            letterSpacing: 3,
            color: "var(--color-cne-red)",
          }}
        >
          WHAT THEY&rsquo;RE SAYING
        </div>
        <h2
          id="press-h"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(40px, 6vw, 72px)",
            margin: "4px 0 0",
            letterSpacing: 1,
            color: "var(--color-cne-ink)",
            lineHeight: 0.9,
          }}
        >
          Press &amp; reviews.
        </h2>
      </div>
      <div
        className="cne-onscroll-stagger cne-press-grid"
        style={{ display: "grid", gap: 18, maxWidth: 1100, margin: "0 auto" }}
      >
        {press.map((p, i) => (
          <blockquote
            key={p.pub}
            className="cne-hover-lift"
            style={{
              margin: 0,
              background: "var(--color-cne-paper)",
              border: "4px solid var(--color-cne-ink)",
              padding: 24,
              boxShadow: "6px 6px 0 var(--color-cne-red)",
              transform: `rotate(${i % 2 ? 0.4 : -0.4}deg)`,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 48,
                color: "var(--color-cne-red)",
                lineHeight: 0.5,
                marginBottom: 6,
              }}
            >
              &ldquo;
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 18,
                lineHeight: 1.4,
                color: "var(--color-cne-ink)",
                fontWeight: 500,
                margin: 0,
              }}
            >
              {p.quote}
            </p>
            <cite
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                flexWrap: "wrap",
                fontFamily: "var(--font-display)",
                fontSize: 14,
                letterSpacing: 2,
                marginTop: 16,
                color: "var(--color-cne-ink)",
                fontStyle: "normal",
              }}
            >
              <span>— {p.pub.toUpperCase()}</span>
              {"url" in p && p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--color-cne-red)",
                    textDecoration: "none",
                    borderBottom: "2px solid var(--color-cne-red)",
                    paddingBottom: 1,
                  }}
                >
                  Read →
                </a>
              ) : null}
            </cite>
          </blockquote>
        ))}
      </div>

      <style>{`
        .cne-press-grid { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 720px) { .cne-press-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
