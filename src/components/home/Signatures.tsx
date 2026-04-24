import type { ReactElement } from "react";
import Image from "next/image";
import { BurgerPhoto } from "@/components/art/BurgerPhoto";

type Photo = { src: string; alt: string };

const items: Array<{
  name: string;
  desc: string;
  photo?: Photo;
  fallbackTone?: "warm" | "bright" | "cream";
  tag?: string;
}> = [
  {
    name: "Burgers",
    desc: "Two smashed patties. Two cheese.",
    photo: { src: "/photos/double.jpg", alt: "Chris N Eddy's smash burger" },
    tag: "SIGNATURE",
  },
  {
    name: "Fries",
    desc: "Golden, salty, house-seasoned.",
    photo: { src: "/photos/fries.jpg", alt: "Chris N Eddy's fries with slider" },
  },
  {
    name: "Shakes",
    desc: "20oz. Quiet legend.",
    fallbackTone: "cream",
  },
];

export function Signatures(): ReactElement {
  return (
    <section
      aria-labelledby="signatures-h"
      style={{ padding: "100px clamp(20px, 5vw, 60px) 60px", background: "var(--color-cne-cream)" }}
    >
      <div className="cne-onscroll-up" style={{ textAlign: "center", marginBottom: 48 }}>
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
        className="cne-onscroll-stagger cne-signatures-grid"
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
                background: "var(--color-cne-ink)",
              }}
            >
              {it.photo ? (
                <Image
                  src={it.photo.src}
                  alt={it.photo.alt}
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <BurgerPhoto tone={it.fallbackTone ?? "warm"} angle="card" label={it.name} idSeed={`sig-${i}`} />
              )}
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
