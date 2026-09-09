"use client";

import { useEffect, useRef } from "react";
import type { MenuItem } from "@/data/menu";
import { ways, extras } from "@/data/menu";
import { itemOrderUrl, formatPrice } from "@/lib/otter";

export type WayId = (typeof ways)[number]["id"];

type Props = {
  item: MenuItem | null;
  way: WayId;
  onWayChange: (id: WayId) => void;
  onClose: () => void;
};

/**
 * Bottom sheet on a phone, right-hand drawer on desktop — same component, the
 * breakpoint does the rest.
 *
 * The sheet exists because Otter can't take preselected modifiers through a
 * link. Rather than make someone choose toppings twice, it names the exact
 * checkboxes waiting on the next screen, then hands off to that one item.
 */
export function ItemSheet({ item, way, onWayChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  const selected = ways.find((w) => w.id === way) ?? ways[0];

  return (
    <>
      <div
        className={`cne-scrim${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`cne-sheet${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={item ? item.name : "Item"}
        aria-hidden={open ? undefined : true}
      >
        <div className="cne-sheet-grab" aria-hidden="true" />
        <button ref={closeRef} className="cne-xbtn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="cne-sheet-body">
          {item && (
            <>
              <div
                className="cne-sheet-shot"
                style={
                  item.photo
                    ? { backgroundImage: `url(/menu/${item.photo}.webp)` }
                    : undefined
                }
                role="img"
                aria-label={item.name}
              />
              <div className="cne-sheet-hd">
                <h3>{item.name}</h3>
                <div className="p">{formatPrice(item.price)}</div>
              </div>
              {item.desc && <div className="cne-sheet-desc">{item.desc}</div>}

              {item.takesToppings && (
                <>
                  <div className="cne-ways" style={{ padding: "14px 15px 0", margin: 0 }}>
                    {ways.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className="cne-way"
                        aria-pressed={w.id === way}
                        onClick={() => onWayChange(w.id)}
                      >
                        <div className="t">{w.name.toUpperCase()}</div>
                        <div className="s">{w.summary}</div>
                      </button>
                    ))}
                  </div>

                  <div className="cne-tapcard">
                    <div className="t">{selected.name} — tap these on the next screen</div>
                    <div className="cne-taplist">
                      {selected.taps.map((t) => (
                        <span key={t}>☐ {t}</span>
                      ))}
                    </div>
                    <div className="note">
                      Toppings are free and can&rsquo;t be pre-set from a link, so we name them
                      here instead of making you choose twice.
                    </div>
                  </div>

                  <div className="cne-addon">
                    <span>Add Pickle · free</span>
                    <span>Remove Cheese · free</span>
                    {extras.map((e) => (
                      <span key={e.name}>
                        {e.name} · +{formatPrice(e.price)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={{ height: 16 }} />
            </>
          )}
        </div>

        <div className="cne-sheet-foot">
          {item && (
            <>
              <a
                className="cne-otter"
                href={itemOrderUrl(item)}
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
      </div>
    </>
  );
}
