import type { ReactElement } from "react";
import { brand } from "@/data/brand";
import { ways } from "@/data/menu";

/**
 * The part they agreed on, beside the part they didn't — one column each,
 * divided by the same 4px rule that runs down the split above.
 */
export function StoryColumns(): ReactElement {
  const [chris, eddy] = ways;

  return (
    <div className="cne-twocol">
      <div className="cne-sec cne-rv">
        <div className="cne-eyebrow">The part they agreed on</div>
        <h2>THE PATTY ISN&rsquo;T UP FOR DEBATE.</h2>
        <p>
          Two patties, smashed thin, on two slices of American, on a buttered Martin&rsquo;s roll.{" "}
          <b>Nine months of daily tastings</b> got them there, and nothing has changed it since.
        </p>
        <p>
          It went into a Hollywood parking lot in late {brand.founded}, into the Sunset flagship in
          2021, and onto the festival road after that.
        </p>
        <div className="cne-facts">
          <div>
            <b>Nine months</b> of daily tastings before opening
          </div>
          <div>
            <b>~{brand.festivalsPerYear}</b> festival dates a year since 2023
          </div>
          <div>
            <b>Two more doors</b> &mdash; Glendale and Van Nuys, on the way
          </div>
        </div>
      </div>

      <div className="cne-sec cne-rv">
        <div className="cne-eyebrow">The part they didn&rsquo;t</div>
        <h2>SO WE STOPPED PICKING A WINNER.</h2>
        <p>
          Most places call it &ldquo;the works&rdquo; and charge you for it. Here{" "}
          <b>every topping is free</b>, and the two Ways on the board are just the two ways the
          founders actually eat it.
        </p>
        <p>
          Order either one by name. Extra cheese is a dollar, halal is two, and nothing else costs
          anything.
        </p>
        <div className="cne-facts">
          <div>
            <b>{chris.name}</b> {chris.summary}
          </div>
          <div>
            <b>{eddy.name}</b> {eddy.summary}
          </div>
          <div>
            <b>Free</b> every topping, both ways
          </div>
        </div>
      </div>
    </div>
  );
}
