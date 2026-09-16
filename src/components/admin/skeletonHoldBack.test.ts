import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleHoldBack, SKELETON_HOLD_MS } from "./skeletonHoldBack";

// `SkeletonHoldBack.tsx`'s component is a thin `useState`/`useEffect`
// wrapper around `scheduleHoldBack` — there's no DOM renderer in this
// project's Vitest setup (it runs in the plain `node` environment, no
// jsdom, and this repo's tsconfig `jsx: "preserve"` means a `.tsx` module
// can't even be loaded by Vitest directly), so the timing contract that
// actually matters is tested here directly, with fake timers, against the
// plain (non-JSX) module the component wraps.

describe("scheduleHoldBack", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reveal before the threshold (children stay hidden)", () => {
    const onReveal = vi.fn();
    scheduleHoldBack(onReveal);

    vi.advanceTimersByTime(SKELETON_HOLD_MS - 1);

    expect(onReveal).not.toHaveBeenCalled();
  });

  it("reveals once the threshold elapses (children shown)", () => {
    const onReveal = vi.fn();
    scheduleHoldBack(onReveal);

    vi.advanceTimersByTime(SKELETON_HOLD_MS);

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending timer, matching an unmount's cleanup", () => {
    const onReveal = vi.fn();
    const cancel = scheduleHoldBack(onReveal);

    cancel();
    vi.advanceTimersByTime(SKELETON_HOLD_MS * 2);

    expect(onReveal).not.toHaveBeenCalled();
  });

  it("honours a custom delay instead of the default", () => {
    const onReveal = vi.fn();
    scheduleHoldBack(onReveal, 50);

    vi.advanceTimersByTime(49);
    expect(onReveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
