import Image from "next/image";
import type { ReactElement } from "react";
import { brand } from "@/data/brand";

export function Footer(): ReactElement {
  return (
    <footer
      style={{
        background: "var(--color-cne-ink)",
        color: "var(--color-cne-cream)",
        padding: "60px clamp(20px, 5vw, 60px) 28px",
        borderTop: "4px solid var(--color-cne-ink)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 48,
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ gridColumn: "span 1", minWidth: 220 }}>
          <Image
            src="/cne-logo.webp"
            alt={brand.name}
            width={141}
            height={80}
            style={{ height: 80, width: "auto", filter: "drop-shadow(3px 4px 0 rgba(0,0,0,0.4))" }}
          />
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#c9c2b7",
              marginTop: 16,
              maxWidth: 340,
              lineHeight: 1.5,
            }}
          >
            Smashed sliders, done right. Pop-up in 2020, Hollywood since 2021.
          </div>
        </div>

        <FooterColumn
          title="Visit"
          rows={[
            "Hollywood",
            "Glendale (Spring ’26)",
            "Van Nuys (Spring ’26)",
          ]}
        />
        <FooterColumn title="Menu" rows={["Sliders", "Combos", "Sides", "Drinks"]} />
        <FooterColumn
          title="Contact"
          rows={[
            { label: brand.phone, href: `tel:${brand.phoneTel}` },
            { label: brand.email, href: `mailto:${brand.email}` },
            { label: brand.ig, href: brand.igUrl, external: true },
          ]}
        />
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: "48px auto 0",
          paddingTop: 20,
          borderTop: "2px solid rgba(255,255,255,.1)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: 1.5,
          color: "#8a8377",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>© {new Date().getFullYear()} Chris N Eddy’s — Hollywood, CA</span>
        <span>Made with 🔥 + Martin’s rolls</span>
      </div>
    </footer>
  );
}

type Row = string | { label: string; href: string; external?: boolean };

function FooterColumn({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          letterSpacing: 2,
          color: "var(--color-cne-yellow)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {rows.map((r, i) => {
        if (typeof r === "string") {
          return (
            <div
              key={i}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "#c9c2b7",
                marginTop: 10,
              }}
            >
              {r}
            </div>
          );
        }
        return (
          <a
            key={i}
            href={r.href}
            {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            style={{
              display: "block",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#c9c2b7",
              marginTop: 10,
              textDecoration: "none",
            }}
          >
            {r.label}
          </a>
        );
      })}
    </div>
  );
}
