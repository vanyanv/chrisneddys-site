import type { ReactElement } from "react";
import { timeline } from "@/data/timeline";

export function Timeline(): ReactElement {
  return (
    <section
      aria-labelledby="road-h"
      style={{ padding: "40px clamp(20px, 5vw, 60px)", maxWidth: 1280, margin: "0 auto", width: "100%" }}
    >
      <h2
        id="road-h"
        className="cne-reveal"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6vw, 72px)",
          margin: "0 0 24px",
          letterSpacing: 1,
          color: "var(--color-cne-ink)",
          textShadow: "4px 4px 0 var(--color-cne-yellow)",
        }}
      >
        THE ROAD SO FAR.
      </h2>
      <ol
        className="cne-stagger cne-timeline-grid"
        style={{ display: "grid", gap: 18, listStyle: "none", padding: 0, margin: 0 }}
      >
        {timeline.map((t, i) => (
          <li
            key={t.year}
            className="cne-hover-lift"
            style={{
              padding: 22,
              background: i % 2 ? "var(--color-cne-yellow)" : "var(--color-cne-paper)",
              border: "4px solid var(--color-cne-ink)",
              boxShadow: "5px 5px 0 var(--color-cne-red)",
              transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)`,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 48,
                color: "var(--color-cne-red)",
                letterSpacing: 1,
                lineHeight: 0.9,
              }}
            >
              {t.year}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--color-cne-ink)",
                marginTop: 6,
              }}
            >
              {t.label}
            </div>
          </li>
        ))}
      </ol>
      <style>{`
        .cne-timeline-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 900px) { .cne-timeline-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 520px) { .cne-timeline-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
