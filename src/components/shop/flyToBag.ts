"use client";

/**
 * The add-to-bag arc.
 *
 * When something is added, a small copy of the product image flies from the
 * gallery up to the bag button in the header. It answers "where did that go"
 * with the answer itself rather than with a toast that has to be read, and it
 * is the reason the bag button can appear silently on the first add without
 * anyone wondering when it arrived.
 *
 * Two details make it work rather than merely move:
 *
 *  - The midpoint is lifted 90px above the straight line, so the path is an arc
 *    with weight to it instead of a linear slide.
 *  - The bag button does not exist yet on the very first add. It is briefly
 *    mounted invisible, measured, and hidden again, so the flight has somewhere
 *    real to land and the button can pop in underneath it.
 *
 * Everything is `position: fixed` against the viewport and removed on finish,
 * so nothing here can affect layout even if it is interrupted mid-flight.
 */

const BAG_BUTTON_ID = "cne-bag-btn";
/** Matches the mount animation in counter.css, so the two read as one motion. */
const DURATION = 620;

export function flyToBag(source: HTMLElement | null, onArrive: () => void) {
  const reduced =
    typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!source || reduced || typeof document === "undefined") {
    onArrive();
    return;
  }

  const target = measureBagButton();
  if (!target) {
    onArrive();
    return;
  }

  const from = source.getBoundingClientRect();
  if (from.width === 0) {
    onArrive();
    return;
  }

  const flyer = document.createElement("div");
  flyer.className = "cne-flyer";
  flyer.setAttribute("aria-hidden", "true");
  // The drawn cap, minus the mark — at 56px the embroidery is noise.
  flyer.innerHTML =
    '<div class="cne-cap"><span class="btn"></span><span class="crown"></span><span class="brim"></span></div>';
  flyer.style.left = `${from.left + from.width / 2 - 28}px`;
  flyer.style.top = `${from.top + from.height / 2 - 28}px`;
  document.body.appendChild(flyer);

  const dx = target.left + target.width / 2 - (from.left + from.width / 2);
  const dy = target.top + target.height / 2 - (from.top + from.height / 2);

  const done = () => {
    flyer.remove();
    onArrive();
  };

  if (typeof flyer.animate !== "function") {
    done();
    return;
  }

  const animation = flyer.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(.7) rotate(-16deg)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(.14) rotate(-30deg)`, opacity: 0.2 },
    ],
    { duration: DURATION, easing: "cubic-bezier(.42,.02,.42,1)" },
  );

  animation.onfinish = done;
  animation.oncancel = done;
}

/**
 * Where the bag button is, or is about to be.
 *
 * On the first add the button is not in the DOM at all — the bag is empty, so
 * there is nothing for it to be. Rather than guess a corner, this mounts the
 * real element invisibly for one measurement and takes it straight back out, so
 * the flight lands exactly where the button will appear a frame later.
 */
function measureBagButton(): DOMRect | null {
  const existing = document.getElementById(BAG_BUTTON_ID);
  if (existing) return existing.getBoundingClientRect();

  const slot = document.getElementById("cne-bag-slot");
  if (!slot) return null;

  const ghost = document.createElement("button");
  ghost.className = "cne-bagbtn";
  ghost.style.visibility = "hidden";
  ghost.style.pointerEvents = "none";
  ghost.textContent = "BAG 1";
  slot.appendChild(ghost);
  const rect = ghost.getBoundingClientRect();
  ghost.remove();
  return rect;
}
