import { flagship } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { OpenStatus } from "@/components/shared/OpenStatus";
import { LocationCard } from "@/components/locations/LocationCard";

/** The Hollywood store card the prototype puts on the home page. */
export function HollywoodCard() {
  const loc = flagship;

  return (
    // Both declared on the card rather than on each button: the surface and
    // the store are properties of where the link sits, not of the link.
    <div className="cne-loc is-live" data-surface="location-card" data-location={slugFor(loc)}>
      <LocationCard loc={loc} surface="location-card" status={<OpenStatus locationId={loc.id} />} />
    </div>
  );
}
