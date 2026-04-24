import type { ReactElement } from "react";

export function HeroStamp({
  topLine = "SIGNATURE",
  bottomLine = "DOUBLE",
}: {
  topLine?: string;
  bottomLine?: string;
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
        letterSpacing: 1,
        border: "3px solid var(--color-cne-ink)",
        boxShadow: "4px 4px 0 var(--color-cne-ink)",
        lineHeight: 1.05,
        textAlign: "center",
        transform: "rotate(-6deg)",
      }}
    >
      <div style={{ fontSize: 18, color: "var(--color-cne-ink)" }}>{topLine}</div>
      <div style={{ fontSize: 30, color: "var(--color-cne-red)", marginTop: 2 }}>{bottomLine}</div>
    </div>
  );
}
