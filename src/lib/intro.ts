/**
 * Gating for the home page's first-visit welcome intro (issue #81): a
 * fixed-viewport vortex overlay, desktop only, shown once per visitor.
 */

/** localStorage flag: once set, the intro never shows again on this device. */
export const INTRO_STORAGE_KEY = "cne-welcome-intro-seen";

/** Set on `<html>` the moment a visit is gated in — before hydration, by the
 * inline script `WelcomeIntro` renders, so the CSS curtain in
 * `intro.css` can hide the page with no flash. Also read by `SlideCode.tsx`
 * so its own vortex can't fire while this one is up. */
export const INTRO_GATE_CLASS = "cne-intro-gate";

export interface ShouldShowIntroInput {
  /** `localStorage.getItem(INTRO_STORAGE_KEY)` — `null` means never seen. */
  stored: string | null;
  /** `(min-width: 901px)` */
  wide: boolean;
  /** `(hover: hover) and (pointer: fine)` */
  finePointer: boolean;
  /** `(prefers-reduced-motion: reduce)` */
  reducedMotion: boolean;
}

/**
 * Whether a fresh page load should run the welcome intro: first visit only,
 * desktop with a real mouse, motion allowed.
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
 * marks the flag seen and adds `INTRO_GATE_CLASS` to `<html>` so
 * `intro.css`'s curtain covers the page before React ever runs. Every read
 * and write is wrapped in try/catch: a storage throw (private browsing,
 * etc.) just means the intro doesn't show.
 */
export const INTRO_GATE_SCRIPT = `(function(){try{var k=${JSON.stringify(
  INTRO_STORAGE_KEY,
)},c=${JSON.stringify(
  INTRO_GATE_CLASS,
)},s=window.localStorage.getItem(k),w=matchMedia("(min-width: 901px)").matches,f=matchMedia("(hover: hover) and (pointer: fine)").matches,r=matchMedia("(prefers-reduced-motion: reduce)").matches;if(s===null&&w&&f&&!r){window.localStorage.setItem(k,"1");document.documentElement.classList.add(c)}}catch(e){}})();`;
