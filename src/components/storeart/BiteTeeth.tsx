/**
 * Two rows of fat, rounded monster teeth (idea 8) that snap shut over a
 * button's top and bottom edges on hover, focus or press — see `.cne-bite`
 * in `chrome-art.css`. Purely decorative: `aria-hidden`, `pointer-events:
 * none`, and positioned so it never changes the button's own size or click
 * target.
 */
const X = [10, 30, 50, 70, 90];

/** `down` teeth hang from the top edge; the rest point up from the bottom. */
function teethPath(down: boolean) {
  return X.map((x, i) => {
    const w = 9;
    const h = i % 2 ? 13 : 16;
    return down
      ? `M${x - w},0 C${x - w},${h * 0.6} ${x - 3},${h} ${x},${h} C${x + 3},${h} ${x + w},${h * 0.6} ${x + w},0 Z`
      : `M${x - w},20 C${x - w},${20 - h * 0.6} ${x - 3},${20 - h} ${x},${20 - h} C${x + 3},${20 - h} ${x + w},${20 - h * 0.6} ${x + w},20 Z`;
  }).join(" ");
}

export function BiteTeeth({ position }: { position: "top" | "bottom" }) {
  return (
    <span className={`cne-bite cne-bite-${position}`} aria-hidden="true">
      <svg
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        fill="#fff8e7"
        stroke="#14110d"
        strokeWidth={1.5}
      >
        <path d={teethPath(position === "top")} />
      </svg>
    </span>
  );
}
