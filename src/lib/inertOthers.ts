/**
 * Makes everything on the page except `keep` (and the ancestors that lead to
 * it) `inert`, and returns a function that undoes exactly that.
 *
 * `aria-modal` and a Tab trap tell keyboard and screen-reader users the page
 * behind a hand-rolled dialog is gone; `inert` makes it true. It walks from each
 * kept element up to <body> and inerts the siblings along the way, so an
 * ancestor of the dialog (say <main>, when the dialog is rendered inside it) is
 * never inerted.
 *
 * Pass the scrim as well as the dialog: an inert scrim would swallow the tap
 * that is meant to dismiss.
 *
 * Counted per element, so two overlays open at once release in either order,
 * and anything that was already inert before is left alone.
 */
const holds = new WeakMap<Element, number>();
const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"]);

export function inertOthers(keep: Array<Element | null | undefined>): () => void {
  const kept = keep.filter((el): el is Element => !!el);
  const path = new Set<Element>();
  for (const el of kept) {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) path.add(n);
  }
  const mine: Element[] = [];
  for (const el of path) {
    const parent = el.parentElement;
    if (!parent) continue;
    for (const sib of Array.from(parent.children)) {
      if (path.has(sib) || SKIP.has(sib.tagName) || mine.includes(sib)) continue;
      const count = holds.get(sib) ?? 0;
      if (count === 0 && sib.hasAttribute("inert")) continue;
      holds.set(sib, count + 1);
      sib.setAttribute("inert", "");
      mine.push(sib);
    }
  }
  return () => {
    for (const sib of mine) {
      const count = (holds.get(sib) ?? 1) - 1;
      if (count > 0) {
        holds.set(sib, count);
      } else {
        holds.delete(sib);
        sib.removeAttribute("inert");
      }
    }
  };
}
