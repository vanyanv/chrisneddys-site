"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/data/menu";
import { ways, extras } from "@/data/menu";
import { buildFor } from "@/data/build";
import { framingFor } from "@/data/photoFocus";
import { itemOrderUrl, formatPrice, itemPhotoAlt } from "@/lib/otter";
import { WayPicker } from "./WayPicker";

export type WayId = (typeof ways)[number]["id"];

type Props = {
  item: MenuItem | null;
  /**
   * Separate from `item` on purpose: the item stays mounted after closing so
   * the sheet keeps its height, which is what the slide animates against.
   */
  open: boolean;
  way: WayId;
  onWayChange: (id: WayId) => void;
  onClose: () => void;
};

/**
 * Everything the browser will Tab to, in document order.
 *
 * The `[tabindex="-1"]` exclusion covers buttons as well: the Way picker is a
 * radio group, so the unselected radio is a real `<button>` held out of the tab
 * order. Counting it as a stop would put the trap's "last" element one short.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How far down the sheet has to travel before letting go dismisses it. */
const DISMISS_RATIO = 0.33;
/** A flick counts even when it is short: px per ms, downward. */
const FLICK_VELOCITY = 0.5;

/**
 * Bottom sheet on a phone, right-hand drawer on desktop — same component, the
 * breakpoint does the rest.
 *
 * The sheet exists because Otter can't take preselected modifiers through a
 * link. Rather than make someone choose toppings twice, it names the exact
 * checkboxes waiting on the next screen, then hands off to that one item.
 */
export function ItemSheet({ item, open, way, onWayChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // `aria-modal` tells a screen reader the rest of the page is gone; it
      // does not stop Tab from walking into it. Without this, the tab after
      // ADD ON OTTER lands on a menu row behind the scrim.
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const stops = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !sheet.contains(active);
      if (e.shiftKey ? active === first || outside : active === last || outside) {
        e.preventDefault();
        // `stops.length === 0` returned above, so first/last are defined here.
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // The page behind a modal shouldn't scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  /**
   * Drag to dismiss.
   *
   * The grab bar has always been drawn here, and on a phone that bar is the
   * universal promise of swipe-to-dismiss. Nothing was listening, so the
   * gesture did nothing and the only way out was a small ✕ in the corner.
   *
   * The listeners sit on the bar rather than on the whole sheet on purpose:
   * the body below it scrolls, and a drag handler spanning both has to guess
   * every frame whether a downward move means "scroll the list" or "close
   * this", which is how sheets end up feeling unreliable.
   */
  const drag = useRef<{ id: number; y0: number; t0: number; dy: number } | null>(null);
  /* State rather than a `classList.add`. React owns `className` on the sheet,
     so an imperative class is wiped by the next render — which happens partway
     through the very first gesture, taking the pointer capture with it and
     dropping the release onto the scrim behind. */
  const [dragging, setDragging] = useState(false);

  /* The offset goes through a custom property instead. Nothing passes a `style`
     prop to the sheet, so React never touches it and it survives renders. */
  const setOffset = useCallback((px: number) => {
    sheetRef.current?.style.setProperty("--cne-drag", `${px}px`);
  }, []);

  const onGrabDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Stops the mousedown/click emulation this gesture would otherwise end in,
    // and the text selection that comes with dragging across the sheet.
    e.preventDefault();
    drag.current = { id: e.pointerId, y0: e.clientY, t0: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // Downward only. Pulling up on a sheet that is already at its top should
    // do nothing rather than lift it off the bottom of the screen.
    d.dy = Math.max(0, e.clientY - d.y0);
    setOffset(d.dy);
  };

  const endGrab = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
    const velocity = d.dy / Math.max(1, e.timeStamp - d.t0);
    if (d.dy > height * DISMISS_RATIO || velocity > FLICK_VELOCITY) {
      // Let the close transition carry it the rest of the way from where the
      // finger left it, rather than snapping back first and then sliding out.
      onClose();
    } else {
      setOffset(0);
    }
  };

  /* A sheet dragged halfway and dismissed must not reopen halfway. Zeroing on
     *close* rather than on open is what keeps that invisible: the moment `open`
     goes false the `.is-open` rule that reads --cne-drag stops applying, so the
     sheet is already heading for translateY(102%) and resetting the variable
     costs nothing. Doing it on open would leave one frame where the sheet
     jumps to the old offset instead of sliding up from the bottom. */
  useEffect(() => {
    if (!open) setOffset(0);
  }, [open, setOffset]);

  const selected = ways.find((w) => w.id === way) ?? ways[0];
  const build = item ? buildFor(item.id) : undefined;
  /* `taps` are the Otter checkbox labels verbatim, which is right when the copy
     is telling you what to press. The ticket is listing what is in the bag, so
     it wants the thing rather than the instruction: "Add Lettuce" → "Lettuce". */
  const freeToppings = selected.taps.map((t) => t.replace(/^Add /, ""));

  /**
   * The ticket, open or shut.
   *
   * Shut is a phone compromise, not the intent: the photo plus the price, the
   * Ways and the button is already the whole screen, and the evidence that a
   * big photograph sells the item is stronger than the evidence that an
   * itemised list does.
   *
   * Open needs width *and* height. A 460px drawer on a 900px-tall laptop has
   * about 78px left after the hero, the price, the Ways and the button, which
   * buys one clipped line and looks like a bug rather than a choice. Measured,
   * not guessed: at 940px the ticket clears its header and three lines.
   *
   * Matched after mount rather than during render. The site is a static export,
   * so the HTML is built with no viewport to measure and reading one at render
   * time would be a hydration mismatch — same reason `useItemSheet` reads its
   * `?way=` parameter in an effect.
   */
  const [ticketOpen, setTicketOpen] = useState(false);
  useEffect(() => {
    setTicketOpen(window.matchMedia("(min-width: 901px) and (min-height: 940px)").matches);
  }, []);

  return (
    <>
      <div
        className={`cne-scrim${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`cne-sheet${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={item ? item.name : "Item"}
        inert={!open}
      >
        <div
          className="cne-sheet-grab"
          aria-hidden="true"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={endGrab}
          onPointerCancel={endGrab}
        >
          {/* The bar itself is drawn by ::before, so this element can be the
              26px-tall hit area a thumb actually needs. Not focusable: the
              keyboard route out is Escape and the ✕, and a tab stop that only
              works with a pointer is a tab stop that does nothing. */}
        </div>
        <button ref={closeRef} className="cne-xbtn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="cne-sheet-body">
          {item && (
            <>
              {/* The shot stays a bare `role="img"` element and the name sits
                  beside it rather than inside it: a `role="img"` subtree is not
                  exposed to a screen reader, so an `<h3>` nested in there would
                  be the item's name, silently. */}
              <div className="cne-sheet-hero">
                <div
                  className={`cne-sheet-shot${item.photo ? " is-photo" : ""}`}
                  style={
                    item.photo
                      ? ({
                          backgroundImage: `url(/menu/${item.photo}.webp)`,
                          /* Per-photo framing — see photoFocus.ts. The CSS
                             carries a fallback for both, so a photo missing
                             from that map still renders sensibly. */
                          "--cne-shot-focus": `${framingFor(item.photo)[0]}%`,
                          "--cne-shot-zoom": `${framingFor(item.photo)[1]}%`,
                        } as React.CSSProperties)
                      : undefined
                  }
                  role="img"
                  aria-label={itemPhotoAlt(item)}
                />
                <h3 className="cne-sheet-name">{item.name}</h3>
              </div>

              <div className="cne-sheet-hd">
                {/* Every price in `menu.ts` is the Hollywood pickup price, so
                    the sheet says which counter it is quoting rather than
                    letting a number stand on its own. */}
                <span className="w">Pickup · Hollywood</span>
                <span className="p">{formatPrice(item.price)}</span>
              </div>
              {item.desc && <p className="cne-sheet-desc">{item.desc}</p>}

              {item.takesToppings && (
                <WayPicker
                  way={way}
                  onChange={onWayChange}
                  label="Topping style"
                  className="cne-ways-sheet"
                />
              )}
            </>
          )}
        </div>

        {/* The highest-intent link on the site reports as itself. It used to
            inherit the pathname, which filed every add-to-cart from the sheet
            under `/menu/`. */}
        <div className="cne-sheet-foot" data-surface="item-sheet">
          {item && (
            <>
              <a
                className="cne-otter"
                href={itemOrderUrl(item, "item-sheet")}
                data-item={item.id}
                target="_blank"
                rel="noopener noreferrer"
              >
                ADD ON OTTER · {formatPrice(item.price)} →
              </a>
              <p className="cne-fine">
                Opens this exact item on our ordering page, ready to add.
              </p>
            </>
          )}
        </div>

        {/* The ticket: what the tap card, its note and the add-on chips became.
            Picking a Way prints that Way's toppings into this list as free line
            items, so the control has a result you can watch instead of a list
            of chores it rewrites. */}
        {item?.takesToppings && (
          <div className={`cne-ticket${ticketOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="cne-ticket-btn"
              aria-expanded={ticketOpen}
              aria-controls="cne-ticket-panel"
              onClick={() => setTicketOpen((v) => !v)}
            >
              <span className="t">What lands in the bag</span>
              {/* The count moves with the Way, so the row reports the picker's
                  result even while the ticket is shut. */}
              <span className="c">
                {freeToppings.length} {freeToppings.length === 1 ? "topping" : "toppings"} free
              </span>
              <span className="s" aria-hidden="true" />
            </button>
            <div className="cne-ticket-wrap">
              <div className="cne-ticket-panel" id="cne-ticket-panel">
                <div className="cne-ticket-pad">
                  {build?.map((line) => (
                    <div key={line.n} className="cne-tl">
                      <span className="q">{line.q} &times;</span>
                      <span className="n">{line.n}</span>
                    </div>
                  ))}
                  {freeToppings.map((t, i) => (
                    <div
                      key={t}
                      className="cne-tl is-free"
                      /* Printed in order, the way a ticket comes off a
                         printer. Suppressed under reduced motion. */
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <span className="q">+</span>
                      <span className="n">{t}</span>
                      <span className="v">Free</span>
                    </div>
                  ))}
                  <div className="cne-tl is-total">
                    <span className="n">Total</span>
                    <span className="v">{formatPrice(item.price)}</span>
                  </div>
                  <p className="cne-ticket-note">
                    Toppings can&rsquo;t be pre-set from a link, so they get ticked on the
                    next screen. All free.
                  </p>
                  <div className="cne-ticket-extra">
                    <span className="l">Also on the next screen</span>
                    {extras.map((e) => (
                      <span key={e.name} className="x">
                        {e.name} · +{formatPrice(e.price)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
