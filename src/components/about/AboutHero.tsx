import type { ReactElement } from "react";

export function AboutHero(): ReactElement {
  return (
    <section
      aria-labelledby="about-h1"
      style={{
        background: "var(--color-cne-red)",
        color: "var(--color-cne-cream)",
        padding: "60px clamp(20px, 5vw, 60px) 80px",
        borderBottom: "4px solid var(--color-cne-ink)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="cne-halftone" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="cne-reveal"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            letterSpacing: 3,
            color: "var(--color-cne-yellow)",
            textTransform: "uppercase",
          }}
        >
          Our story
        </div>
        <h1
          id="about-h1"
          className="cne-reveal"
          style={{
            animationDelay: ".1s",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(64px, 10vw, 140px)",
            margin: "6px 0 0",
            lineHeight: 0.9,
            color: "var(--color-cne-cream)",
            textShadow: "6px 6px 0 var(--color-cne-ink)",
            letterSpacing: 1,
          }}
        >
          TWO KIDS.
          <br />
          ONE RECIPE.
        </h1>
      </div>
    </section>
  );
}
