import type { ReactElement } from "react";

const props = [
  { title: "NEVER FROZEN", desc: "Smashed in front of you, every time.", sym: "★" },
  { title: "MARTIN’S ROLLS", desc: "The only bun. Buttered, reverse-toasted.", sym: "✦" },
  { title: "100 FESTIVALS/YR", desc: "Coachella, Lollapalooza, Stagecoach, more.", sym: "♦" },
  { title: "OPEN TIL 2AM", desc: "Late-night LA, every day of the week.", sym: "✸" },
] as const;

export function ValueProps(): ReactElement {
  return (
    <section
      aria-label="Why Chris N Eddy’s"
      style={{
        padding: "60px clamp(20px, 5vw, 60px)",
        background: "var(--color-cne-paper)",
        borderBottom: "4px solid var(--color-cne-ink)",
      }}
    >
      <div
        className="cne-valueprops-grid"
        style={{
          display: "grid",
          gap: 0,
          borderTop: "4px solid var(--color-cne-ink)",
          borderLeft: "4px solid var(--color-cne-ink)",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        {props.map((p, i) => (
          <div
            key={p.title}
            className="cne-hover-lift"
            style={{
              padding: 30,
              background: i % 2 === 0 ? "var(--color-cne-cream)" : "var(--color-cne-yellow)",
              borderRight: "4px solid var(--color-cne-ink)",
              borderBottom: "4px solid var(--color-cne-ink)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 50,
                color: "var(--color-cne-red)",
                lineHeight: 0.7,
              }}
              aria-hidden="true"
            >
              {p.sym}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                color: "var(--color-cne-ink)",
                marginTop: 14,
                letterSpacing: 1,
                lineHeight: 1,
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--color-cne-ink)",
                opacity: 0.8,
                marginTop: 8,
              }}
            >
              {p.desc}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .cne-valueprops-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 900px) { .cne-valueprops-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 520px) { .cne-valueprops-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
