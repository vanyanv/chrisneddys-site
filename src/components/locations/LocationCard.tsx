import type { CSSProperties, ReactNode } from "react";
import type { Location } from "@/data/locations";
import { orderUrl, type OrderSurface } from "@/lib/otter";
import { DirectionsLink } from "@/components/locations/DirectionsLink";
import { Monster } from "@/components/mascots/Monster";

/**
 * One store's card: name, address, hours and the button row every hand-copied
 * version of this block already agreed on. The four places that used to write
 * this out — the home page, the locations map, a store's own page, and the
 * order page — render this instead and pass in only what actually differs
 * between them.
 *
 * No wrapping element and no `"use client"`: the outer `<div>` (its classes,
 * `data-surface`/`data-location`, and any click handling) stays with the
 * caller, since that is the part that genuinely differs — LocationsView's is
 * a selectable map card, the others are not.
 */
export function LocationCard({
  loc,
  surface,
  headingTag: Heading = "h3",
  headingClassName,
  headingStyle,
  status,
  addressAs: Address = "div",
  addressStyle,
  children,
  showButtonsWhenClosed = false,
  footer,
}: {
  loc: Location;
  /** Tags the ORDER link so it reports back to Otter which surface sent it. */
  surface: OrderSurface;
  headingTag?: "h2" | "h3" | "p";
  headingClassName?: string;
  headingStyle?: CSSProperties;
  /** The open/closed pill next to the name — omit for none. */
  status?: ReactNode;
  addressAs?: "div" | "address";
  addressStyle?: CSSProperties;
  /** Extra content between the hours and the button row, shown only while open. */
  children?: ReactNode;
  /** Show the button row even when the location is not open (a store's own page still offers directions). */
  showButtonsWhenClosed?: boolean;
  /** Content after the button row, rendered regardless of open state. */
  footer?: ReactNode;
}) {
  const showButtons = loc.isOpen || showButtonsWhenClosed;

  return (
    <>
      {/* A wall-mural monster marking the location as open — the card that
          wraps this component (`.cne-loc` on the index and the store page
          alike) needs `position: relative` for the corner badge to sit on
          it. A location that has not opened yet gets no mascot. */}
      {loc.isOpen && (
        <Monster
          species="classic"
          bodyColor="#b6e01f"
          irisColor="#e63027"
          size={24}
          className="cne-badge-corner is-tr"
        />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Heading className={headingClassName} style={headingStyle}>
          {loc.name.toUpperCase()}
        </Heading>
        {status}
      </div>

      <Address className="cne-loc-addr" style={addressStyle}>
        {loc.address}
        <br />
        {loc.city}, {loc.region} {loc.postal}
      </Address>

      {loc.isOpen && (
        <div className="cne-loc-hrs">
          {loc.hours.map(([day, hrs]) => (
            <div className="r" key={day}>
              <span>{day.toUpperCase()}</span>
              <b>{hrs}</b>
            </div>
          ))}
        </div>
      )}

      {loc.isOpen && children}

      {showButtons && (
        <div className="cne-loc-btns">
          {loc.otter && (
            <a
              className="cne-mini is-red"
              href={orderUrl(surface)}
              target="_blank"
              rel="noopener noreferrer"
            >
              ORDER
            </a>
          )}
          <DirectionsLink loc={loc} className="cne-mini is-plain" />
          {loc.phoneTel && (
            <a className="cne-mini is-plain" href={`tel:${loc.phoneTel}`}>
              CALL
            </a>
          )}
        </div>
      )}

      {footer}
    </>
  );
}
