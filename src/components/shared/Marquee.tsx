import type { CSSProperties, ReactElement } from "react";

export function Marquee({
  items,
  bg = "var(--color-cne-ink)",
  fg = "var(--color-cne-yellow)",
  ink = "var(--color-cne-ink)",
  fontSize = 26,
  separator = "★",
}: {
  items: readonly string[];
  bg?: string;
  fg?: string;
  ink?: string;
  fontSize?: number;
  separator?: string;
}): ReactElement {
  const trackStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: fg,
  };
  const content = (
    <span style={{ display: "inline-flex", gap: 36, alignItems: "center" }}>
      {items.map((t, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 36 }}>
          {t}
          <span style={{ color: fg, opacity: 0.7 }} aria-hidden="true">
            {separator}
          </span>
        </span>
      ))}
    </span>
  );
  return (
    <div
      role="presentation"
      aria-hidden="true"
      style={{
        background: bg,
        overflow: "hidden",
        borderTop: `3px solid ${ink}`,
        borderBottom: `3px solid ${ink}`,
      }}
    >
      <div className="cne-marquee-track" style={trackStyle}>
        {content}
        {content}
        {content}
      </div>
    </div>
  );
}
