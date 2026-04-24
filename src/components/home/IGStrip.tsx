import type { ReactElement } from "react";
import Image from "next/image";
import { IGTile } from "@/components/art/IGTile";
import { brand } from "@/data/brand";

type TilePhoto = { src: string; alt: string };
const photoTiles: Record<number, TilePhoto> = {
  0: { src: "/photos/ig-monster.jpg", alt: "Stacked sliders in front of Chris N Eddy's monster mural" },
  1: { src: "/photos/ig-pile.jpg", alt: "Pile of Chris N Eddy's smash sliders against red graffiti neon" },
  2: { src: "/photos/ig-stack.jpg", alt: "Towering Chris N Eddy's smash burger with pickles and sauce on flame-print paper" },
  3: { src: "/photos/ig-pyramid.jpg", alt: "Three sliders stacked on Chris N Eddy's wax paper with loaded fries" },
  4: { src: "/photos/ig-neon.jpg", alt: "Three Chris N Eddy's sliders in hand with the shop neon glowing behind" },
};

export function IGStrip(): ReactElement {
  const tiles = Array.from({ length: 6 }, (_, i) => i);
  return (
    <section
      aria-labelledby="ig-h"
      style={{ background: "var(--color-cne-red)", color: "var(--color-cne-cream)" }}
    >
      <div
        className="cne-ig-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 24,
          flexWrap: "wrap",
          padding: "40px clamp(20px, 5vw, 32px) 16px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              opacity: 0.8,
            }}
          >
            FROM THE GRAM
          </div>
          <h2
            id="ig-h"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 5vw, 48px)",
              letterSpacing: 1,
              marginTop: 4,
              marginBottom: 0,
              lineHeight: 1,
            }}
          >
            {brand.ig}
          </h2>
        </div>
        <a
          href={brand.igUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cne-hover-grow"
          style={{
            background: "var(--color-cne-cream)",
            color: "var(--color-cne-ink)",
            border: "3px solid var(--color-cne-ink)",
            padding: "12px 22px",
            fontFamily: "var(--font-display)",
            fontSize: 14,
            letterSpacing: 2,
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: "4px 4px 0 var(--color-cne-ink)",
          }}
        >
          Follow →
        </a>
      </div>
      <div
        className="cne-ig-grid"
        style={{ display: "grid", gap: 0, background: "var(--color-cne-red)" }}
      >
        {tiles.map((i) => {
          const photo = photoTiles[i];
          return (
            <div
              key={i}
              className="cne-hover-grow"
              style={{
                borderRight: i < 5 ? "3px solid var(--color-cne-ink)" : "none",
                borderTop: "3px solid var(--color-cne-ink)",
                cursor: "pointer",
                position: "relative",
                aspectRatio: photo ? "1 / 1" : undefined,
                background: photo ? "var(--color-cne-ink)" : undefined,
                overflow: "hidden",
              }}
            >
              {photo ? (
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 520px) 50vw, (max-width: 900px) 33vw, 16vw"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <IGTile idx={i} tone="warm" />
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        .cne-ig-grid { grid-template-columns: repeat(6, 1fr); }
        @media (max-width: 900px) { .cne-ig-grid { grid-template-columns: repeat(3, 1fr) !important; } .cne-ig-grid > *:nth-child(3n) { border-right: none !important; } }
        @media (max-width: 520px) { .cne-ig-grid { grid-template-columns: repeat(2, 1fr) !important; } .cne-ig-grid > * { border-right: none !important; } .cne-ig-grid > *:nth-child(odd) { border-right: 3px solid var(--color-cne-ink) !important; } }
      `}</style>
    </section>
  );
}
