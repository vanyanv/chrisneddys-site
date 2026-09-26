"use client";

import { useEffect, useRef, useState } from "react";
import type { Location } from "@/data/locations";
import { statusLabel } from "@/lib/hours";
import { slugFor } from "@/lib/locationSlug";
import { useStoreStatus } from "@/lib/useStoreStatus";
import {
  onOrderPickerRequest,
  orderableLocations,
  orderTargetUrl,
  rememberOrderChoice,
  type PickerRequest,
} from "@/lib/orderChoice";

/**
 * The "Which location?" panel (issue #178). Mounted once in the site layout
 * and opened by `openOrderPicker`: by an ORDER button the first time it is
 * tapped, and by the store name in the header or the phone bar to switch.
 *
 * Each store is a real link to its own ordering page, so picking one is a
 * single tap that opens the order in a new tab, and it is remembered so the
 * next ORDER skips this panel. A native `<dialog>` gives the focus trap,
 * Escape to close and the inert page behind it for free. On a phone it rises
 * from the bottom where the thumb already is; wider screens get a small card
 * in the middle (`.cne-pick` in counter.css).
 */
export function OrderPicker() {
  const ref = useRef<HTMLDialogElement>(null);
  const [req, setReq] = useState<PickerRequest | null>(null);

  useEffect(() => onOrderPickerRequest(setReq), []);

  useEffect(() => {
    const dialog = ref.current;
    if (req && dialog && !dialog.open) dialog.showModal();
  }, [req]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="cne-pick"
      aria-labelledby="cne-pick-h"
      onClose={() => setReq(null)}
      // A tap on the dimmed backdrop lands on the dialog itself, never on the
      // card inside it, so that is the one target that closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {req && (
        <div className="cne-pick-in" data-surface={req.surface}>
          <div className="cne-pick-hd">
            <h2 id="cne-pick-h">Which location?</h2>
            <button type="button" className="cne-pick-x" onClick={close} aria-label="Close">
              ✕
            </button>
          </div>
          <ul className="cne-pick-list">
            {orderableLocations().map((loc) => (
              <li key={loc.id} data-location={slugFor(loc)}>
                <PickRow
                  loc={loc}
                  href={orderTargetUrl(loc, req.surface, req.item)}
                  item={req.item?.id}
                  onPick={() => {
                    rememberOrderChoice(loc.id);
                    // After the click has started the navigation, not during it.
                    setTimeout(close, 0);
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="cne-pick-note">Same menu, same prices. We&rsquo;ll remember your pick.</p>
        </div>
      )}
    </dialog>
  );
}

function PickRow({
  loc,
  href,
  item,
  onPick,
}: {
  loc: Location;
  href: string;
  item?: string;
  onPick: () => void;
}) {
  const status = useStoreStatus(loc.id);
  const shut = status?.state === "closed";

  return (
    <a
      className="cne-pick-row"
      href={href}
      data-item={item}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onPick}
    >
      <span className="cne-pick-name">{loc.name.toUpperCase()}</span>
      <span className={`cne-pick-stat${shut ? " is-shut" : ""}`}>
        {status ? statusLabel(status) : " "}
      </span>
      <span className="cne-pick-addr">{loc.address}</span>
      <span className="cne-pick-go" aria-hidden="true">
        →
      </span>
    </a>
  );
}
