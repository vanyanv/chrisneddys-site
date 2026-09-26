import { openLocations } from "@/lib/openLocations";
import { slugFor } from "@/lib/locationSlug";
import type { OrderSurface } from "@/lib/otter";
import { OpenStatus } from "@/components/shared/OpenStatus";
import { LocationCard } from "@/components/locations/LocationCard";

/**
 * Every open store's card, for the pages that used to show Hollywood's alone
 * (the home page's "Where we are." and each menu item's "Where to get it").
 *
 * On a phone the cards sit in a row you swipe, each a little narrower than
 * the screen so the next one peeks in from the edge; that peek is the only
 * hint needed, so there are no arrows or dots. Wider screens fit as many
 * side by side as the column allows, which in the home page's half-width
 * column means stacked (`.cne-loc-rail` in counter.css, issue #178).
 */
export function OpenLocationCards({ surface }: { surface: OrderSurface }) {
  const open = openLocations();

  return (
    <div className={`cne-loc-rail${open.length > 1 ? " is-multi" : ""}`}>
      {open.map((loc) => (
        // Both declared on the card rather than on each button: the surface and
        // the store are properties of where the link sits, not of the link.
        <div
          key={loc.id}
          className="cne-loc is-live"
          data-surface="location-card"
          data-location={slugFor(loc)}
        >
          <LocationCard loc={loc} surface={surface} status={<OpenStatus locationId={loc.id} />} />
        </div>
      ))}
    </div>
  );
}
