import type { ReactElement } from "react";

/**
 * The seam between the two halves: the call that started it.
 *
 * This carries the page's h1. The two Ways above it are the page's subject but
 * they are a pair, and neither one of them is the story — this line is.
 */
export function StorySeam(): ReactElement {
  return (
    <section className="cne-band">
      <div className="cne-eyebrow cne-rv">Spring 2020 &middot; the seam</div>
      <h1 className="cne-band-big cne-rv">
        Eddy called Chris with an idea. Chris was in San Francisco.{" "}
        <em>He packed up that week.</em>
      </h1>
      <div className="cne-hair cne-rv" aria-hidden="true" />
      <p className="cne-band-after cne-rv">
        They&rsquo;d been best friends since they were thirteen. What they argued about for the
        next nine months was the burger &mdash; and they never fully settled it. So both answers
        went on the menu, free, and the argument became the ordering system.
      </p>
    </section>
  );
}
