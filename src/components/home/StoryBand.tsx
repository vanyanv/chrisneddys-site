import type { ReactElement } from "react";
import { BurgerPhoto } from "@/components/art/BurgerPhoto";
import { CTAButton } from "@/components/shared/CTAButton";

export function StoryBand(): ReactElement {
  return (
    <section
      aria-labelledby="story-h"
      style={{
        background: "var(--color-cne-ink)",
        color: "var(--color-cne-cream)",
        padding: "100px clamp(20px, 5vw, 60px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -30,
          top: 30,
          fontFamily: "var(--font-display)",
          fontSize: 280,
          color: "var(--color-cne-red)",
          opacity: 0.15,
          lineHeight: 0.8,
          transform: "rotate(8deg)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        EST
        <br />
        2020
      </div>

      <div
        className="cne-storyband-grid"
        style={{
          display: "grid",
          gap: 60,
          alignItems: "center",
          position: "relative",
          zIndex: 2,
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div className="cne-reveal">
          <div
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
          <h2
            id="story-h"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 7vw, 88px)",
              lineHeight: 0.95,
              margin: "10px 0 20px",
              letterSpacing: 1,
            }}
          >
            Two friends.
            <br />
            <span style={{ color: "var(--color-cne-yellow)" }}>One parking lot.</span>
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 18,
              lineHeight: 1.55,
              opacity: 0.9,
              maxWidth: 520,
              margin: 0,
            }}
          >
            Best friends since 13. In 2020 Eddy called Chris with an idea. Chris drove down from
            SF that week. Nine months of tasting later, they had a recipe. Today, three locations
            and 100 festivals a year.
          </p>
          <div style={{ marginTop: 28 }}>
            <CTAButton
              href="/about/"
              variant="yellow"
              size="lg"
              style={{
                border: "3px solid var(--color-cne-cream)",
                boxShadow: "5px 5px 0 var(--color-cne-red)",
              }}
            >
              Read the full story →
            </CTAButton>
          </div>
        </div>
        <div
          className="cne-reveal-scale"
          style={{
            animationDelay: ".1s",
            aspectRatio: "4/5",
            maxHeight: 480,
            border: "5px solid var(--color-cne-cream)",
            transform: "rotate(-1.5deg)",
            overflow: "hidden",
            boxShadow: "12px 12px 0 var(--color-cne-red)",
          }}
        >
          <BurgerPhoto tone="warm" angle="hero" label="hollywood, 2020" idSeed="story-band" />
        </div>
      </div>

      <style>{`
        .cne-storyband-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) { .cne-storyband-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
