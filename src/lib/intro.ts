/**
 * Gating for the home page's welcome intro (issues #81, #102): a
 * fixed-viewport vortex overlay, desktop only, shown on every visit to `/`.
 */

/** localStorage opt-out: when set, the intro is skipped. The site never
 * writes it; the perf scripts and screenshot tooling do, so they measure the
 * page underneath. (The old once-per-browser flag, `cne-welcome-intro-seen`,
 * is deliberately ignored now so browsers that saw the intro see it again.) */
export const INTRO_STORAGE_KEY = "cne-welcome-intro-off";

/** Set on `<html>` the moment a visit is gated in — before hydration, by the
 * inline script `WelcomeIntro` renders, so the CSS curtain in
 * `intro.css` can hide the page with no flash. Also read by `SlideCode.tsx`
 * so its own vortex can't fire while this one is up. */
export const INTRO_GATE_CLASS = "cne-intro-gate";

export interface ShouldShowIntroInput {
  /** `localStorage.getItem(INTRO_STORAGE_KEY)` — `null` means not opted out. */
  stored: string | null;
  /** `(min-width: 901px)` */
  wide: boolean;
  /** `(hover: hover) and (pointer: fine)` */
  finePointer: boolean;
  /** `(prefers-reduced-motion: reduce)` */
  reducedMotion: boolean;
}

/**
 * Whether a page load should run the welcome intro: every visit, desktop
 * with a real mouse, motion allowed, not opted out.
 *
 * Mirrored, in raw JS, by `INTRO_GATE_SCRIPT` below so the decision can run
 * synchronously before hydration (no flash) — keep the two in sync.
 */
export function shouldShowIntro({
  stored,
  wide,
  finePointer,
  reducedMotion,
}: ShouldShowIntroInput): boolean {
  return stored === null && wide && finePointer && !reducedMotion;
}

/**
 * Inline, pre-hydration gate script: decides via `shouldShowIntro`'s logic
 * (hand-mirrored — a `<script>` can't import it), and if it should show,
 * adds `INTRO_GATE_CLASS` to `<html>` so `intro.css`'s curtain covers the
 * page before React ever runs. Wrapped in try/catch: a throw anywhere just
 * means the intro doesn't show.
 */
export const INTRO_GATE_SCRIPT = `(function(){try{var k=${JSON.stringify(
  INTRO_STORAGE_KEY,
)},c=${JSON.stringify(
  INTRO_GATE_CLASS,
)},s=null;try{s=window.localStorage.getItem(k)}catch(e){}var w=matchMedia("(min-width: 901px)").matches,f=matchMedia("(hover: hover) and (pointer: fine)").matches,r=matchMedia("(prefers-reduced-motion: reduce)").matches;if(s===null&&w&&f&&!r){document.documentElement.classList.add(c)}}catch(e){}})();`;
