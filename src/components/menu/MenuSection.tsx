import type { ReactElement } from "react";
import { menu, type MenuCategoryKey } from "@/data/menu";

const TITLES: Record<MenuCategoryKey, string> = {
  sliders: "SLIDERS",
  ways: "THE WAYS",
  combos: "COMBOS",
  sides: "SIDES",
  drinks: "DRINKS",
};

export function MenuSection({ category }: { category: MenuCategoryKey }): ReactElement {
  const items = menu[category];
  return (
    <section
      aria-labelledby={`menu-sec-${category}`}
      style={{ padding: "60px clamp(16px, 5vw, 60px) 0", maxWidth: 1280, margin: "0 auto", width: "100%" }}
    >
      <div className="cne-onscroll-up" style={{ marginBottom: 24 }}>
        <h2
          id={`menu-sec-${category}`}
          className="cne-menu-h2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px, 9vw, 96px)",
            margin: 0,
            letterSpacing: 1,
            color: "var(--color-cne-ink)",
            textShadow: "4px 4px 0 var(--color-cne-red)",
            lineHeight: 0.9,
          }}
        >
          {TITLES[category]}
        </h2>
        <div style={{ height: 4, background: "var(--color-cne-ink)", marginTop: 14 }} />
      </div>
      <div
        className="cne-onscroll-stagger cne-menu-grid"
        style={{ display: "grid", gap: "0 36px" }}
      >
        {items.map((it) => (
          <div
            key={it.id}
            className="cne-hover-grow"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "18px 0",
              borderBottom: "2px dashed var(--color-cne-ink)",
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="cne-menu-item-name"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(20px, 5vw, 28px)",
                  color: "var(--color-cne-ink)",
                  letterSpacing: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {it.name}
                {it.signature && (
                  <span
                    style={{
                      background: "var(--color-cne-red)",
                      color: "var(--color-cne-cream)",
                      fontFamily: "var(--font-display)",
                      fontSize: 10,
                      letterSpacing: 2,
                      padding: "3px 8px",
                      border: "2px solid var(--color-cne-ink)",
                    }}
                  >
                    SIGNATURE
                  </span>
                )}
              </div>
              <div
                className="cne-menu-item-desc"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--color-cne-muted)",
                  marginTop: 4,
                }}
              >
                {it.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .cne-menu-grid { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 820px) { .cne-menu-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) {
          .cne-menu-h2 { text-shadow: 3px 3px 0 var(--color-cne-red) !important; }
          .cne-menu-item-desc { font-size: 13px !important; }
        }
      `}</style>
    </section>
  );
}
