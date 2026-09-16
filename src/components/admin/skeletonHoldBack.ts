/**
 * How long a loading skeleton waits before it's allowed to appear at all.
 * Mirrors `--rack-dur-2` (200ms, "something appears or disappears in
 * place") from `admin-rack.css`'s motion scale — this is that same token's
 * job, just applied before the skeleton's first paint instead of to a CSS
 * transition. `Motion.dc.html`'s loading ladder: content between 400ms and
 * 3s gets a skeleton, "held back 200ms first, so a fast response never
 * makes it blink." A route that resolves inside this window never shows a
 * skeleton at all — nothing here flashes for 60ms.
 */
export const SKELETON_HOLD_MS = 200;

/**
 * Starts the hold-back timer and calls `onReveal` once it elapses. Kept in
 * its own plain (non-JSX) module, separate from `SkeletonHoldBack.tsx`'s
 * component, so the timing itself — armed, still pending, fires, cancelled
 * — is unit-testable with fake timers without a DOM or a JSX transform.
 * Returns the cancel function; call it on unmount (or whenever the hold
 * should be abandoned) to clear the timer, the same contract a `useEffect`
 * cleanup expects.
 */
export function scheduleHoldBack(
  onReveal: () => void,
  delayMs: number = SKELETON_HOLD_MS,
): () => void {
  const timer = setTimeout(onReveal, delayMs);
  return () => clearTimeout(timer);
}
