import type { ReactElement } from "react";
import { BurgerPhoto } from "@/components/art/BurgerPhoto";
import { HeroStamp } from "@/components/art/HeroStamp";
import { Marquee } from "@/components/shared/Marquee";
import { CTAButton } from "@/components/shared/CTAButton";
import { brand } from "@/data/brand";

const marqueeItems = [
  "100 festivals/year",
  "smashed daily",
  "martin’s rolls",
  "since 2020",
  "open til 2AM",
  "hollywood · glendale · van nuys",
];

export function Hero(): ReactElement {
  return (
    <section
      aria-labelledby="hero-h1"
      style={{
        background: "var(--color-cne-red)",
        color: "var(--color-cne-cream)",
        padding: "40px 0 0",
        position: "relative",
        overflow: "hidden",
        borderBottom: "4px solid var(--color-cne-ink)",
      }}
    >
      <div className="cne-halftone" />

      <div
        className="cne-hero-grid"
        style={{
          display: "grid",
          gap: 30,
          padding: "30px clamp(20px, 5vw, 60px)",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div>
          <div
            className="cne-reveal"
            style={{
              display: "inline-block",
              padding: "6px 14px",
              background: "var(--color-cne-cream)",
              color: "var(--color-cne-red)",
              fontFamily: "var(--font-display)",
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              border: "3px solid var(--color-cne-ink)",
              boxShadow: "3px 3px 0 var(--color-cne-ink)",
              lineHeight: 1.1,
            }}
          >
            ★ Open til 2AM ★
          </div>
          <h1
            id="hero-h1"
            className="cne-reveal"
            style={{
              animationDelay: ".1s",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(64px, 10vw, 160px)",
              lineHeight: 0.85,
              margin: "24px 0 0",
              letterSpacing: 1,
              color: "var(--color-cne-cream)",
              textShadow: "5px 5px 0 var(--color-cne-ink)",
            }}
          >
            SLIDERS <span style={{ color: "var(--color-cne-yellow)" }}>SO GOOD</span> THEY HURT.
          </h1>
          <p
            className="cne-reveal"
            style={{
              animationDelay: ".2s",
              fontFamily: "var(--font-body)",
              fontSize: 20,
              lineHeight: 1.4,
              color: "var(--color-cne-cream)",
              opacity: 0.95,
              marginTop: 24,
              maxWidth: 540,
            }}
          >
            Smashed to order. Two patties, two cheese, one buttered Martin&rsquo;s potato roll. Hollywood, since 2020.
          </p>
          <div
            className="cne-reveal"
            style={{ animationDelay: ".3s", display: "flex", gap: 14, flexWrap: "wrap", marginTop: 32 }}
          >
            <CTAButton href={brand.orderUrl} external variant="yellow" size="lg" style={{ boxShadow: "5px 5px 0 var(--color-cne-ink)" }}>
              Order on Otter →
            </CTAButton>
            <CTAButton href="/menu/" variant="cream" size="lg" style={{ boxShadow: "5px 5px 0 var(--color-cne-ink)" }}>
              See menu
            </CTAButton>
          </div>
        </div>
        <div
          className="cne-reveal-scale"
          style={{
            animationDelay: ".15s",
            position: "relative",
            aspectRatio: "1/1",
            maxWidth: 640,
            width: "100%",
            justifySelf: "center",
          }}
        >
          <BurgerPhoto tone="studio" angle="hero" idSeed="hero" />
          <HeroStamp />
        </div>
      </div>

      <Marquee
        items={marqueeItems}
        bg="var(--color-cne-ink)"
        fg="var(--color-cne-yellow)"
        ink="var(--color-cne-ink)"
        fontSize={26}
      />

      <style>{`
        .cne-hero-grid { grid-template-columns: 1fr 1.1fr; }
        @media (max-width: 900px) {
          .cne-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
