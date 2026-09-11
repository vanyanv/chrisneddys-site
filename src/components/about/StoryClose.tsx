import type { ReactElement } from "react";
import Link from "next/link";
import { ways } from "@/data/menu";

/**
 * The page ends where it started, as a choice — and here the choice goes
 * somewhere: each button opens the menu with that Way already selected, which
 * is the same state the Ways rail and every item sheet read off `?way=`.
 */
export function StoryClose(): ReactElement {
  const [chris, eddy] = ways;

  return (
    <section className="cne-sec cne-close cne-rv">
      <div className="cne-eyebrow">So, then</div>
      <h2>WHOSE SIDE ARE YOU ON?</h2>
      <p className="cne-close-p">
        Pick one and the menu opens with it already selected. You can switch when you get here.
        They do.
      </p>
      <div className="cne-cta">
        <Link className="cne-big is-chris" href={`/menu/?way=${chris.id}`}>
          {chris.name.toUpperCase()} &rarr;
        </Link>
        <Link className="cne-big is-eddy" href={`/menu/?way=${eddy.id}`}>
          {eddy.name.toUpperCase()} &rarr;
        </Link>
      </div>
    </section>
  );
}
