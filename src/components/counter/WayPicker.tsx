"use client";

import { useRef } from "react";
import { ways } from "@/data/menu";
import type { WayId } from "./ItemSheet";

/**
 * The two Ways, as a radio group.
 *
 * They read as toggles and behave as a radio group: exactly one is always on,
 * and turning one on turns the other off. `aria-pressed` described neither of
 * those facts, so a screen reader announced "Chris's Way, toggle button,
 * pressed" with no group, no name, and no hint that a second choice existed.
 *
 * It lives in one file because the menu rail and the item sheet both render it
 * and the keyboard contract below — roving tabindex, arrows to move, Home and
 * End to jump — is the kind of thing that goes wrong the moment there are two
 * copies of it.
 */
export function WayPicker({
  way,
  onChange,
  label,
  labelledBy,
  className,
  style,
}: {
  way: WayId;
  onChange: (id: WayId) => void;
  /** Use when there is no visible heading to point at. */
  label?: string;
  /** Id of the visible heading that names the group. Wins over `label`. */
  labelledBy?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const groupRef = useRef<HTMLDivElement | null>(null);

  /* A radio group is one tab stop, and the arrows move inside it. Moving the
     selection moves the focus with it, which is what tells someone using a
     screen reader that the choice actually changed. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = ways.findIndex((w) => w.id === way);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? ways.length - 1
          : e.key === "ArrowRight" || e.key === "ArrowDown"
            ? (i + 1) % ways.length
            : (i - 1 + ways.length) % ways.length;
    // `next` is always a valid index into `ways` (computed mod its length).
    const nextWay = ways[next];
    if (!nextWay) return;
    onChange(nextWay.id);
    groupRef.current?.querySelectorAll<HTMLButtonElement>(".cne-way")[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      className={className ? `cne-ways ${className}` : "cne-ways"}
      style={style}
      role="radiogroup"
      aria-label={labelledBy ? undefined : (label ?? "Topping style")}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {ways.map((w) => {
        const on = w.id === way;
        return (
          <button
            key={w.id}
            type="button"
            className="cne-way"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(w.id)}
          >
            <span className="t">{w.name.toUpperCase()}</span>
            <span className="s">{w.summary}</span>
          </button>
        );
      })}
    </div>
  );
}
