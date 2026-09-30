import type { CSSProperties } from "react";
import { SLIDER_STACKS } from "@/data/menu";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The patty count on a slider's card (issue #210): a red dot per patty and
 * a yellow dot per slice of cheese, the dot column from the Van Nuys
 * spec-sheet wall. The dots stamp on as the section scrolls in
 * (`menu-art.css`). Nothing for an item `SLIDER_STACKS` doesn't list.
 *
 * One labelled image rather than loose dots, so a screen reader hears
 * "2 patties, 2 slices of cheese" once.
 */
export function PattyDots({ id }: { id: string }) {
  const stack = SLIDER_STACKS[id];
  if (!stack) return null;
  const [patties, cheese] = stack;
  const label = [
    patties ? plural(patties, "patty", "patties") : "",
    plural(cheese, "slice of cheese", "slices of cheese"),
  ]
    .filter(Boolean)
    .join(", ");
  const dots = [...Array<string>(patties).fill("is-p"), ...Array<string>(cheese).fill("is-c")];
  return (
    <span className="cne-dots" role="img" aria-label={label}>
      {dots.map((kind, d) => (
        <i key={d} className={kind} style={{ "--d": d } as CSSProperties} />
      ))}
    </span>
  );
}

/** What the dots mean, once, under the Sliders heading. */
export function PattyKey() {
  return (
    <p className="cne-dots-key" aria-hidden="true">
      <i className="is-p" /> patty <i className="is-c" /> cheese
    </p>
  );
}
