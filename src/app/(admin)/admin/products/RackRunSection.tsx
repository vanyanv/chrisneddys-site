import type { AdminProduct } from "@/lib/catalogAdmin";
import { runSizeConflicts } from "@/lib/shopCopy";
import { revertOnEscape } from "./revertOnEscape";

/** The bordered, iconed callout under the edition-size field — same
 * treatment as `RefundPanel.tsx`'s `.rack-refund-warning`, just yellow (a
 * caution, not that one's dead stop) and reused for both the pre-lock and
 * post-lock copy `RunSection` renders below. */
function RunWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rack-run-warning">
      <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
        <path d="M8 5v4M8 11.2v.1" />
        <circle cx="8" cy="8" r="6" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

/** "The run" — locked once the first number sells (issue #36's `n-run`
 * annotation: "the count locks the moment number one sells"). Contextual to
 * whichever inventory mode the product is currently in. */
export function RunSection({
  product,
  inventoryN,
  onCommitSize,
  onlineN,
  onCommitOnline,
}: {
  product: AdminProduct;
  inventoryN: number;
  onCommitSize: (raw: string) => void;
  onlineN: number;
  onCommitOnline: (raw: string) => void;
}) {
  if (product.inventory.mode === "untracked") {
    return (
      <div className="rack-hairline">
        <span className="rack-eyebrow">The run</span>
        <p className="rack-run-copy">
          Not tracked yet. Turn on Count or Numbered edition under &ldquo;More details&rdquo; to
          give it a run size.
        </p>
      </div>
    );
  }

  if (product.inventory.mode === "quantity") {
    return (
      <div className="rack-hairline">
        <div className="rack-run-head">
          <span className="rack-eyebrow">The run &mdash; {inventoryN} in stock</span>
        </div>
        <div className="adm-field" style={{ marginTop: 8 }}>
          <label htmlFor={`run-qty-${product.id}`} className="adm-sr-only">
            Quantity in stock
          </label>
          <input
            id={`run-qty-${product.id}`}
            type="number"
            min={0}
            step={1}
            className="adm-input rack-mono"
            defaultValue={String(inventoryN)}
            onBlur={(e) => onCommitSize(e.target.value)}
            onKeyDown={(e) => revertOnEscape(e, String(inventoryN))}
          />
        </div>
      </div>
    );
  }

  // edition — locked the moment anything has sold (issue #36 phase 3's
  // decision, enforced for real by `setInventory`'s `EditionSizeLockedError`
  // in `@/lib/catalogAdmin`; this input mirrors that here so an owner sees
  // the field go read-only rather than typing a new size and getting a
  // rejected save).
  const { sold, reserved, available, setAside } = product.inventory;
  const locked = sold > 0;
  const conflicts = runSizeConflicts(
    [
      product.limitedNote,
      product.description,
      product.limitedCopy,
      product.metaDescription,
      ...product.details,
    ],
    inventoryN,
  );

  return (
    <div className="rack-hairline">
      <div className="rack-run-head">
        <span className="rack-eyebrow">The run &mdash; {inventoryN} made</span>
        <a href={`/admin/products/${product.id}/run`} className="rack-run-link">
          Open the run &rarr;
        </a>
      </div>
      <p className="rack-run-copy">
        {available} for sale online, {setAside} set aside, {sold} sold online, {reserved} held in
        open checkouts.
      </p>
      <div className="adm-field" style={{ marginTop: 8 }}>
        <label htmlFor={`run-size-${product.id}`} className="adm-label">
          Edition size
        </label>
        <input
          id={`run-size-${product.id}`}
          type="number"
          min={1}
          step={1}
          className="adm-input rack-mono"
          defaultValue={String(inventoryN)}
          readOnly={locked}
          aria-readonly={locked}
          disabled={locked}
          onBlur={(e) => {
            if (!locked) onCommitSize(e.target.value);
          }}
          onKeyDown={(e) => revertOnEscape(e, String(inventoryN))}
        />
      </div>
      {/* Two different messages for two different situations, not one moved
       * around: while the run is still editable this warns what's about to
       * become permanent (a decision screen, not just a disabled field
       * after the fact); once `assertEditionSizeUnlocked` in
       * `@/lib/catalogAdmin` has actually locked it, the copy switches to
       * explaining why the field in front of the owner is now read-only.
       * `admin-run.spec.ts` spec 2 pins the unlocked copy to NOT contain
       * the locked copy's "locks the moment number one sells" phrase, so
       * the two stay visibly distinct rather than one being a substring of
       * the other. */}
      {locked ? (
        <RunWarning>
          <strong>This locks the moment number one sells.</strong> The size of the run is a promise
          printed on every certificate, so the field stays read-only from here on.
        </RunWarning>
      ) : (
        <RunWarning>
          <strong>Set this once.</strong> Every number becomes a promise printed on a certificate
          the instant it sells, so the size locks for good the moment the first one does. Get it
          right now, while it&rsquo;s still just a number on a screen.
        </RunWarning>
      )}
      {/* The shop's "ONLY N MADE" flag reads this field; the product's own
       * copy is free text. When they disagree the product page says both
       * (the owner's 2026-09-24 report: "only 20 made" beside "only 50
       * made / numbered /50"), so say so here, where either can be fixed. */}
      {conflicts.length > 0 && (
        <RunWarning>
          <strong>
            The product&rsquo;s copy says {conflicts.join(" and ")}, but Edition size is{" "}
            {inventoryN}.
          </strong>{" "}
          The shop shows both numbers. If {inventoryN} is how many are left to sell online, set
          Edition size to how many were made and use &ldquo;Left to sell online&rdquo; below.
        </RunWarning>
      )}
      {/* The run is how many were made; this is how many of them the online
       * shop sells. The rest are set aside (`setOnlineCount`), so the shop
       * reads "20 of 50 left" under "Only 50 made". */}
      <div className="adm-field" style={{ marginTop: 12 }}>
        <label htmlFor={`run-online-${product.id}`} className="adm-label">
          Left to sell online
        </label>
        <input
          id={`run-online-${product.id}`}
          type="number"
          min={0}
          max={available + setAside}
          step={1}
          className="adm-input rack-mono"
          defaultValue={String(onlineN)}
          onBlur={(e) => onCommitOnline(e.target.value)}
          onKeyDown={(e) => revertOnEscape(e, String(onlineN))}
        />
        <p className="rack-run-copy" style={{ marginTop: 6 }}>
          The shop shows &ldquo;{onlineN} of {inventoryN} left&rdquo;. The rest of the run is set
          aside: sold at the location or kept back. Pick which numbers on the run page.
        </p>
      </div>
      <div className="rack-edgrid" style={{ marginTop: 8 }}>
        {product.editions.map((edition) => (
          <span
            key={edition.number}
            className={`rack-edcell ${
              edition.status === "sold"
                ? "is-sold"
                : edition.status === "reserved"
                  ? "is-reserved"
                  : edition.status === "set_aside"
                    ? "is-aside"
                    : ""
            }`}
            title={`#${edition.number} — ${edition.status === "set_aside" ? "set aside" : edition.status}`}
          />
        ))}
      </div>
      <div className="rack-edlegend">
        <span>
          <i className="is-available"></i>
          {available} online
        </span>
        <span>
          <i className="is-reserved"></i>
          {reserved} held
        </span>
        <span>
          <i className="is-sold"></i>
          {sold} sold
        </span>
        <span>
          <i className="is-aside"></i>
          {setAside} set aside
        </span>
      </div>
    </div>
  );
}
