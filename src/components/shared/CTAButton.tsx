import Link from "next/link";
import type { CSSProperties, ReactElement, ReactNode } from "react";

type Variant = "yellow" | "cream" | "red";

const stylesByVariant: Record<Variant, CSSProperties> = {
  yellow: {
    background: "var(--color-cne-yellow)",
    color: "var(--color-cne-ink)",
    border: "3px solid var(--color-cne-ink)",
    boxShadow: "4px 4px 0 var(--color-cne-ink)",
  },
  cream: {
    background: "var(--color-cne-cream)",
    color: "var(--color-cne-ink)",
    border: "3px solid var(--color-cne-ink)",
    boxShadow: "4px 4px 0 var(--color-cne-ink)",
  },
  red: {
    background: "var(--color-cne-red)",
    color: "var(--color-cne-cream)",
    border: "3px solid var(--color-cne-ink)",
    boxShadow: "4px 4px 0 var(--color-cne-ink)",
  },
};

export function CTAButton({
  href,
  variant = "yellow",
  size = "md",
  external = false,
  children,
  style,
}: {
  href: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  external?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}): ReactElement {
  const padding = size === "lg" ? "18px 30px" : size === "sm" ? "8px 16px" : "10px 20px";
  const fontSize = size === "lg" ? 18 : size === "sm" ? 13 : 14;
  const base: CSSProperties = {
    display: "inline-block",
    ...stylesByVariant[variant],
    padding,
    fontFamily: "var(--font-display)",
    fontSize,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textDecoration: "none",
    lineHeight: 1,
    ...style,
  };

  const className = "cne-hover-grow";

  if (external) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={base}
      >
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} style={base}>
      {children}
    </Link>
  );
}
