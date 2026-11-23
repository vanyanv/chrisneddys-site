/** Shared by the two motion effects: both stand down for reduced motion, and
 * both leave anything the viewer cannot see alone. */
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};
