import { describe, it, expect } from "vitest";
import { LOCKOUT_WINDOW_MS, MAX_FAILED_ATTEMPTS, signInPolicySummary } from "@/lib/signInPolicy";
import * as throttle from "@/lib/signInThrottle";

/**
 * The point of this module is that the sign-in card cannot state a policy
 * the throttle does not enforce. These pin both halves of that: the
 * throttle really does read its limits from here, and the summary string
 * really is derived from them rather than typed out alongside.
 */
describe("signInPolicy", () => {
  it("is the same pair of numbers the throttle enforces", () => {
    expect(throttle.MAX_FAILED_ATTEMPTS).toBe(MAX_FAILED_ATTEMPTS);
    expect(throttle.LOCKOUT_WINDOW_MS).toBe(LOCKOUT_WINDOW_MS);
  });

  it("builds the sign-in card's summary from those numbers", () => {
    expect(signInPolicySummary()).toBe(
      `${MAX_FAILED_ATTEMPTS} tries per ${LOCKOUT_WINDOW_MS / 60_000} min`,
    );
    // The values as they stand today, so a change to either is a change a
    // reader has to make here deliberately rather than by accident.
    expect(signInPolicySummary()).toBe("5 tries per 15 min");
  });
});
