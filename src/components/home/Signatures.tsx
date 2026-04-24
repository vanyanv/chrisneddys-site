import type { ReactElement } from "react";
import { BurgerPhoto } from "@/components/art/BurgerPhoto";

type Tone = "warm" | "bright" | "cream";

const items: Array<{ name: string; desc: string; price: string; tone: Tone; tag?: string }> = [
  { name: "The Double", desc: "Two smashed patties. Two cheese.", price: "8", tone: "warm", tag: "SIGNATURE" },
  { name: "Chris-Cut Fries", desc: "Crinkle cut, house seasoning.", price: "4", tone: "bright" },
  { name: "Strawberry Shake", desc: "20oz. Quiet legend.", price: "6", tone: "cream" },
];

export function Signatures(): ReactElement {
  return (
    <section
      aria-labelledby="signatures-h"
      style={{ padding: "100px clamp(20px, 5vw, 60px) 60px", background: "var(--color-cne-cream)" }}
    >
      <div className="cne-reveal" style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            letterSpacing: 3,
            color: "var(--color-cne-red)",
            textTransform: "uppercase",
          }}
        >
          The lineup
        </div>
        <h2
          id="signatures-h"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(56px, 9vw, 120px)",
            margin: "4px 0 0",
            letterSpacing: 1,
            color: "var(--color-cne-ink)",
            lineHeight: 0.9,
            textShadow: "4px 4px 0 var(--color-cne-yellow)",
          }}
        >
          What we make.
        </h2>
      </div>
      <div
        className="cne-stagger cne-signatures-grid"
        style={{ display: "grid", gap: 24, maxWidth: 1280, margin: "0 auto" }}
      >
        {items.map((it, i) => (
          <article
            key={it.name}
            className="cne-hover-lift"
            style={{
              background: "var(--color-cne-paper)",
              border: "4px solid var(--color-cne-ink)",
              boxShadow: "8px 8px 0 var(--color-cne-red)",
              overflow: "hidden",
              transform: `rotate(${(i - 1) * 0.6}deg)`,
            }}
          >
            <div
              style={{
                aspectRatio: "4/3",
                borderBottom: "4px solid var(--color-cne-ink)",
                position: "relative",
              }}
            >
              <BurgerPhoto tone={it.tone} angle="card" label={it.name} idSeed={`sig-${i}`} />
              {it.tag && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    padding: "4px 10px",
                    background: "var(--color-cne-yellow)",
                    color: "var(--color-cne-ink)",
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                    letterSpacing: 2,
                    border: "2px solid var(--color-cne-ink)",
                  }}
                >
                  {it.tag}
                </div>
              )}
            </div>
            <div style={{ padding: "22px 22px 26px" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 30,
                  color: "var(--color-cne-ink)",
                  letterSpacing: 1,
                  lineHeight: 1,
                }}
              >
                {it.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--color-cne-muted)",
                  marginTop: 6,
                }}
              >
                {it.desc}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 36,
                    color: "var(--color-cne-red)",
                    letterSpacing: 1,
                  }}
                >
                  ${it.price}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    color: "var(--color-cne-ink)",
                    letterSpacing: 2,
                  }}
                >
                  ADD →
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <style>{`
        .cne-signatures-grid { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .cne-signatures-grid { grid-template-columns: 1fr !important; max-width: 500px; } }
      `}</style>
    </section>
  );
}
