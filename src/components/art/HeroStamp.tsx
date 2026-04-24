import type { ReactElement } from "react";

export function HeroStamp({
  label = "THE DOUBLE",
  price = "8",
}: {
  label?: string;
  price?: string;
}): ReactElement {
  return (
    <div
      className="cne-float"
      style={{
        position: "absolute",
        top: 30,
        right: 30,
        background: "var(--color-cne-yellow)",
        color: "var(--color-cne-ink)",
        padding: "14px 20px",
        fontFamily: "var(--font-display)",
        fontSize: 22,
        letterSpacing: 1,
        border: "3px solid var(--color-cne-ink)",
        boxShadow: "4px 4px 0 var(--color-cne-ink)",
        lineHeight: 1.1,
        textAlign: "center",
      }}
    >
      {label}
      <br />
      <span style={{ fontSize: 36, color: "var(--color-cne-red)" }}>${price}</span>
    </div>
  );
}
