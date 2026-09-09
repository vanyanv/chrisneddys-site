import Link from "next/link";
import { brand } from "@/data/brand";

export function SiteFooter() {
  return (
    <footer className="cne-foot">
      <div>
        <b>CHRIS N EDDY&rsquo;S</b> — Smashed sliders, done right. Pop-up in 2020, Hollywood
        since 2021.
      </div>
      <div>
        Hollywood · Glendale · Van Nuys · {brand.phone} ·{" "}
        <a href={brand.igUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {brand.ig}
        </a>{" "}
        ·{" "}
        <Link href="/about/" style={linkStyle}>
          Our story
        </Link>
      </div>
    </footer>
  );
}

const linkStyle = { color: "var(--a-yel)", textDecoration: "none" };
