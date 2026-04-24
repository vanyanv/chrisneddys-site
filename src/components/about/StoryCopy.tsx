import type { ReactElement } from "react";
import { BurgerPhoto } from "@/components/art/BurgerPhoto";

export function StoryCopy(): ReactElement {
  return (
    <section
      style={{
        padding: "60px clamp(20px, 5vw, 60px)",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="cne-storycopy-grid"
        style={{
          display: "grid",
          gap: 60,
          alignItems: "center",
        }}
      >
        <div
          className="cne-onscroll-up"
          style={{ fontFamily: "var(--font-body)", fontSize: 18, lineHeight: 1.6 }}
        >
          <p style={{ marginTop: 0 }}>
            Chris and Eddy: best friends since 13. Spring 2020, Eddy called Chris with an idea.
            Chris packed up SF that week.
          </p>
          <p>
            Nine months of daily tastings. Smashed patty, American cheese, buttered Martin&rsquo;s
            roll. They nailed it.
          </p>
          <p>
            Late 2020: Hollywood parking lot. 2021: the Sunset flagship. Since then, a festival
            road that hasn&rsquo;t stopped — and in 2026, two new doors: Glendale and Van Nuys.
          </p>
        </div>
        <div
          className="cne-onscroll-scale"
          style={{
            aspectRatio: "1/1",
            maxHeight: 480,
            border: "4px solid var(--color-cne-ink)",
            boxShadow: "10px 10px 0 var(--color-cne-red)",
            transform: "rotate(-1.5deg)",
            overflow: "hidden",
          }}
        >
          <BurgerPhoto tone="warm" angle="hero" label="2020 · the original" idSeed="about" />
        </div>
      </div>
      <style>{`
        .cne-storycopy-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) { .cne-storycopy-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
