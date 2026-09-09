import type { ReactElement } from "react";
import { menu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { itemOrderUrl, formatPrice } from "@/lib/otter";

/**
 * One menu category. Every row links straight to that item on Otter, so the
 * shortest path from reading about a slider to ordering it is a single tap.
 */
export function MenuSection({ category }: { category: MenuCategoryKey }): ReactElement {
  const items = menu[category];
  return (
    <section
      aria-labelledby={`menu-sec-${category}`}
      id={`menu-${category}`}
      style={{
        padding: "60px clamp(16px, 5vw, 60px) 0",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
        scrollMarginTop: 80,
      }}
    >
      <div className="cne-onscroll-up" style={{ marginBottom: 24 }}>
        <h2
          id={`menu-sec-${category}`}
          className="cne-menu-h2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px, 7.5vw, 76px)",
            margin: 0,
            letterSpacing: 1,
            color: "var(--color-cne-ink)",
            textShadow: "4px 4px 0 var(--color-cne-red)",
            lineHeight: 0.9,
            textTransform: "uppercase",
          }}
        >
          {categoryTitles[category]}
        </h2>
        <div style={{ height: 4, background: "var(--color-cne-ink)", marginTop: 14 }} />
      </div>

      <div className="cne-onscroll-stagger cne-menu-grid" style={{ display: "grid", gap: "0 36px" }}>
        {items.map((it) => (
          <a
            key={it.id}
            href={itemOrderUrl(it)}
            target="_blank"
            rel="noopener noreferrer"
            className="cne-menu-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 0",
              borderBottom: "2px dashed var(--color-cne-ink)",
              gap: 16,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="cne-menu-item-name"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(19px, 4.4vw, 26px)",
                  color: "var(--color-cne-ink)",
                  letterSpacing: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  lineHeight: 1.15,
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
              {it.desc && (
                <div
                  className="cne-menu-item-desc"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--color-cne-muted)",
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {it.desc}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flex: "none",
              }}
            >
              <span
                className="cne-menu-price"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "clamp(15px, 3.6vw, 19px)",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--color-cne-ink)",
                }}
              >
                {formatPrice(it.price)}
              </span>
              <span
                aria-hidden="true"
                className="cne-menu-chev"
                style={{
                  width: 30,
                  height: 30,
                  flex: "none",
                  borderRadius: "50%",
                  background: "var(--color-cne-red)",
                  color: "var(--color-cne-cream)",
                  border: "2px solid var(--color-cne-ink)",
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ›
              </span>
              <span className="cne-sr-only">Order {it.name} online</span>
            </div>
          </a>
        ))}
      </div>

      <style>{`
        .cne-menu-grid { grid-template-columns: repeat(2, 1fr); }
        .cne-menu-row .cne-menu-chev { transition: transform .16s ease; }
        .cne-menu-row:hover .cne-menu-chev { transform: translateX(3px); }
        .cne-menu-row:hover .cne-menu-item-name { color: var(--color-cne-red); }
        .cne-menu-row:focus-visible {
          outline: 3px solid var(--color-cne-red);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .cne-menu-row .cne-menu-chev { transition: none; }
        }
        @media (max-width: 820px) { .cne-menu-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) {
          .cne-menu-h2 { text-shadow: 3px 3px 0 var(--color-cne-red) !important; }
          .cne-menu-item-desc { font-size: 13px !important; }
        }
      `}</style>
    </section>
  );
}
