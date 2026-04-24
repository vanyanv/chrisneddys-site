import type { ReactElement } from "react";
import { toppings } from "@/data/menu";

export function Toppings(): ReactElement {
  return (
    <section
      aria-labelledby="toppings-h"
      style={{ padding: "60px clamp(20px, 5vw, 60px)", maxWidth: 1280, margin: "0 auto", width: "100%" }}
    >
      <h2
        id="toppings-h"
        className="cne-onscroll-up"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6vw, 72px)",
          margin: "0 0 20px",
          letterSpacing: 1,
          color: "var(--color-cne-ink)",
          textShadow: "4px 4px 0 var(--color-cne-yellow)",
        }}
      >
        TOPPINGS
      </h2>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          letterSpacing: 2,
          color: "var(--color-cne-red)",
          marginBottom: 14,
        }}
      >
        ★ NO EXTRA CHARGE ★
      </div>
      <ul
        className="cne-onscroll-stagger"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {toppings.map((t, i) => (
          <li
            key={t.id}
            style={{
              padding: "10px 18px",
              background: i % 2 ? "var(--color-cne-yellow)" : "var(--color-cne-paper)",
              border: "3px solid var(--color-cne-ink)",
              fontFamily: "var(--font-display)",
              fontSize: 14,
              letterSpacing: 1,
              color: "var(--color-cne-ink)",
              boxShadow: "3px 3px 0 var(--color-cne-ink)",
            }}
          >
            + {t.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
