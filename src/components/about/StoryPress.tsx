import type { ReactElement } from "react";
import { press } from "@/data/press";

/** The three lines that are about the friendship rather than the burger. */
const PUBS = ["NBC Los Angeles", "The Infatuation", "BruinLife"];
const QUOTES = PUBS.map((pub) => press.find((p) => p.pub === pub)).filter(
  (p): p is (typeof press)[number] => Boolean(p),
);

export function StoryPress(): ReactElement {
  return (
    <section className="cne-sec cne-rv">
      <div className="cne-eyebrow">What gets written about</div>
      <h2>THE FRIENDSHIP, BEFORE THE BURGER.</h2>
      <div className="cne-pressrow" style={{ marginTop: 26 }}>
        {QUOTES.map((p) => (
          <blockquote className="cne-quote" key={p.pub}>
            <p>&ldquo;{p.quote}&rdquo;</p>
            <cite>{p.pub.toUpperCase()}</cite>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
