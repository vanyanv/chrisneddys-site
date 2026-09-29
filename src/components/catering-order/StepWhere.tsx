"use client";

import { useEffect, useRef, useState } from "react";
import { CATERING_STORES, type CateringStoreId } from "@/lib/catering/stores";
import type { Fulfilment } from "@/lib/catering/types";
import type { PublicCateringStore } from "@/lib/catering/public";
import type { Address } from "./draft";

type RangeResult = { miles: number | null; inRange: boolean; unknown: boolean };

/** C2: fulfilment, store, and — for delivery — the address plus a live
 * range check against `POST /api/catering/range`. */
export function StepWhere({
  fulfilment,
  store,
  address,
  stores,
  deliveryFeeCents,
  rangeMiles,
  onChange,
  onRangeMiles,
}: {
  fulfilment: Fulfilment | null;
  store: CateringStoreId | null;
  address: Address | null;
  stores: PublicCateringStore[];
  deliveryFeeCents: number;
  rangeMiles: number | null;
  onChange: (patch: {
    fulfilment?: Fulfilment;
    store?: CateringStoreId;
    address?: Address | null;
  }) => void;
  onRangeMiles: (miles: number | null, blocked: boolean) => void;
}) {
  const [addressLine, setAddressLine] = useState(address?.line1 ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [stateCode, setStateCode] = useState(address?.state ?? "CA");
  const [zip, setZip] = useState(address?.zip ?? "");
  const [checking, setChecking] = useState(false);
  const [range, setRange] = useState<RangeResult | null>(
    rangeMiles != null ? { miles: rangeMiles, inRange: true, unknown: false } : null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedStore = stores.find((s) => s.id === store);

  useEffect(() => {
    if (fulfilment !== "delivery" || !store || zip.length !== 5) {
      setRange(null);
      onRangeMiles(null, false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Block Continue for the whole checking window, not just once a
    // definite answer arrives: from the moment a 5-digit ZIP starts a new
    // check (through the debounce and the request itself), `rangeBlocked`
    // must already be true, or the button reads as enabled for that stretch
    // on a store/address that's actually still unverified.
    setChecking(true);
    onRangeMiles(null, true);
    debounceRef.current = setTimeout(() => {
      fetch("/api/catering/range/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, zip }),
      })
        .then((r) => r.json())
        .then((data: RangeResult) => {
          setRange(data);
          onRangeMiles(data.miles, !data.unknown && !data.inRange);
        })
        .catch(() => setRange(null))
        .finally(() => setChecking(false));
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfilment, store, zip]);

  function commitAddress(
    patch: Partial<{
      line1: string;
      city: string;
      state: string;
      zip: string;
      instructions: string;
    }>,
  ) {
    onChange({
      address: {
        line1: patch.line1 ?? addressLine,
        city: patch.city ?? city,
        state: patch.state ?? stateCode,
        zip: patch.zip ?? zip,
        instructions: patch.instructions ?? address?.instructions,
      },
    });
  }

  return (
    <div className="cor-step">
      <h1>How are you getting it?</h1>
      <div className="cor-choice-row">
        <button
          type="button"
          className={`cor-choice${fulfilment === "pickup" ? " is-selected" : ""}`}
          onClick={() => onChange({ fulfilment: "pickup" })}
        >
          <span className="t">Pickup</span>
          <span className="s">Free · ready when you say</span>
        </button>
        <button
          type="button"
          className={`cor-choice${fulfilment === "delivery" ? " is-selected" : ""}`}
          onClick={() => onChange({ fulfilment: "delivery" })}
        >
          <span className="t">Delivery</span>
          <span className="s">
            ${(deliveryFeeCents / 100).toFixed(0)} · within {"10"} miles
          </span>
        </button>
      </div>

      <p className="cor-label">Which location?</p>
      <div className="cor-store-row">
        {CATERING_STORES.map((s) => {
          const pub = stores.find((p) => p.id === s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`cor-choice cor-store${store === s.id ? " is-selected" : ""}`}
              onClick={() => onChange({ store: s.id })}
            >
              <span className="t">{s.name}</span>
              <span className="s">{pub?.address ?? ""}</span>
            </button>
          );
        })}
        <span className="cor-choice cor-store is-coming" aria-disabled="true">
          <span className="t">Glendale</span>
          <span className="s">Coming soon</span>
        </span>
      </div>

      {fulfilment === "pickup" && selectedStore && (
        <p className="cor-note">
          You&rsquo;ll pick up at {selectedStore.address}. Parking lot in front.
        </p>
      )}

      {fulfilment === "delivery" && store && (
        <>
          <label className="cor-field">
            <span className="cor-label">Delivery address</span>
            <input
              type="text"
              value={addressLine}
              placeholder="Street address"
              autoComplete="address-line1"
              onChange={(e) => {
                setAddressLine(e.target.value);
                commitAddress({ line1: e.target.value });
              }}
            />
          </label>
          <div className="cor-address-row">
            <label className="cor-field">
              <span className="cor-label">City</span>
              <input
                type="text"
                value={city}
                autoComplete="address-level2"
                onChange={(e) => {
                  setCity(e.target.value);
                  commitAddress({ city: e.target.value });
                }}
              />
            </label>
            <label className="cor-field is-narrow">
              <span className="cor-label">State</span>
              <input
                type="text"
                value={stateCode}
                maxLength={2}
                autoComplete="address-level1"
                onChange={(e) => {
                  setStateCode(e.target.value.toUpperCase());
                  commitAddress({ state: e.target.value.toUpperCase() });
                }}
              />
            </label>
            <label className="cor-field is-narrow">
              <span className="cor-label">ZIP</span>
              <input
                type="text"
                inputMode="numeric"
                value={zip}
                maxLength={5}
                autoComplete="postal-code"
                onChange={(e) => {
                  const z = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setZip(z);
                  commitAddress({ zip: z });
                }}
              />
            </label>
          </div>
          {checking && <p className="cor-note is-checking">Checking address…</p>}
          {!checking && range && !range.unknown && range.inRange && (
            <p className="cor-note is-ok">
              &check; {range.miles} miles from {selectedStore?.name}. Delivery is $
              {(deliveryFeeCents / 100).toFixed(0)}.
            </p>
          )}
          {!checking && range && !range.unknown && !range.inRange && (
            <p className="cor-note is-error">
              That&rsquo;s {range.miles} miles from {selectedStore?.name} — outside our {10} mile
              range.{" "}
              <a href="/contact/" data-catering="">
                Message us
              </a>{" "}
              and we&rsquo;ll see what we can do.
            </p>
          )}
          {!checking && range?.unknown && (
            <p className="cor-note">We couldn&rsquo;t verify that ZIP — we&rsquo;ll follow up.</p>
          )}
          <label className="cor-field">
            <span className="cor-label">
              Suite, stage or gate <span className="cor-optional">optional</span>
            </span>
            <input
              type="text"
              value={address?.instructions ?? ""}
              onChange={(e) => commitAddress({ instructions: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}

export function whereComplete(
  fulfilment: Fulfilment | null,
  store: CateringStoreId | null,
  address: Address | null,
  rangeBlocked: boolean,
): boolean {
  if (!fulfilment || !store) return false;
  if (fulfilment === "pickup") return true;
  return (
    Boolean(address?.line1 && address.city && address.state && address.zip.length === 5) &&
    !rangeBlocked
  );
}
