import { editionCounts, nextAvailableEditionNumber, type EditionCell } from "@/lib/catalog";

/**
 * The edition map — the shop's one piece of scarcity proof.
 *
 * Fifty cells, one per numbered hat, coloured by the same three states the
 * `editions` table itself uses: still open, held in somebody's open
 * checkout right now, or sold. A buyer can hold their own certificate up to
 * this grid and check the number against it — that is the entire case for
 * drawing every cell instead of just printing "11 of 50 left", and it is
 * why reserved gets its own colour instead of being folded into either of
 * the other two (see `editionCounts` and `queryInventory` in
 * `src/lib/catalog.ts`, and the acceptance note on issue #36 phase 6: "do
 * not present reserved as sold or vice versa").
 *
 * Pure and server-rendered — no client JS, since nothing here is
 * interactive. `editions` is expected sorted by number (`getInventory`
 * already returns it that way); this only reads it, never re-sorts it, so a
 * caller that hands it out of order sees that reflected honestly rather
 * than silently corrected.
 */
export function EditionMap({ editions }: { editions: EditionCell[] }) {
  const { available, reserved, sold } = editionCounts(editions);
  const total = editions.length;
  const next = nextAvailableEditionNumber(editions);

  return (
    <div className="cne-edmap">
      <div className="cne-edmap-head">
        <span className="cne-edmap-count">
          {available === 0 ? "All gone" : `${available} of ${total} left`}
        </span>
        {next !== null && (
          <span className="cne-edmap-next">
            Next number up <b>#{next}</b>
          </span>
        )}
      </div>

      <div
        className="cne-edgrid"
        role="img"
        aria-label={editionMapAriaLabel(available, reserved, sold, total)}
      >
        {editions.map((cell) => (
          <span key={cell.number} className={`cne-edcell is-${cell.status}`} />
        ))}
      </div>

      <div className="cne-edlegend">
        <span>
          <i className="a" /> Still going ({available})
        </span>
        <span>
          <i className="r" /> Mid-checkout ({reserved})
        </span>
        <span>
          <i className="s" /> Gone ({sold})
        </span>
      </div>
    </div>
  );
}

/** A screen reader gets the same three numbers a sighted buyer reads off the
 * grid, rather than fifty individually-announced, meaningless squares. */
function editionMapAriaLabel(
  available: number,
  reserved: number,
  sold: number,
  total: number,
): string {
  return `Edition map: ${available} of ${total} still available, ${reserved} held in someone's checkout, ${sold} sold.`;
}
