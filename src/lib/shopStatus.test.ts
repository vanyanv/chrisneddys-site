import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Carries `import "server-only"`, which throws outside a real Next.js server
// build — stubbed the same way this repo's other server-only-adjacent tests
// do (see the note in src/app/api/checkout/route.test.ts).
vi.mock("server-only", () => ({}));

import { hasPaymentKeys, isShopOpenFor, isShopPausedFor } from "@/lib/shopStatus";
import type { StoreSettings } from "@/lib/orders";

/** A minimal `StoreSettings`-shaped object — only the fields the predicates
 * under test actually read are given real values. */
function settingsWith(patch: Partial<StoreSettings>): StoreSettings {
  return {
    id: "default",
    storeName: "Store",
    supportEmail: "support@example.com",
    pickupEnabled: true,
    pickupAddress: "123 Main St",
    shippingFlatCents: 600,
    shippingFreeOverCents: null,
    shipCountries: ["US"],
    returnsPolicy: "Returns accepted within 30 days.",
    termsText: null,
    shopPaused: false,
    pauseNote: null,
    updatedAt: new Date(),
    ...patch,
  } as StoreSettings;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("hasPaymentKeys", () => {
  it("is false with neither Stripe env var set", () => {
    expect(hasPaymentKeys()).toBe(false);
  });

  it("is false with only the secret key set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    expect(hasPaymentKeys()).toBe(false);
  });

  it("is false with only the webhook secret set", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(hasPaymentKeys()).toBe(false);
  });

  it("is true once both Stripe env vars are set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(hasPaymentKeys()).toBe(true);
  });
});

describe("isShopOpenFor", () => {
  it("is false with no Stripe keys, even with a full settings row", () => {
    expect(isShopOpenFor(settingsWith({}))).toBe(false);
  });

  it("is false with Stripe keys but no returns policy", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({ returnsPolicy: null }))).toBe(false);
  });

  it("is false with Stripe keys and a whitespace-only returns policy", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({ returnsPolicy: "   \n  " }))).toBe(false);
  });

  it("is false with Stripe keys and a returns policy but no support email", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({ supportEmail: "" }))).toBe(false);
  });

  it("is true once Stripe keys, a returns policy and a support email are all present", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({}))).toBe(true);
  });

  it("does not require terms text", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({ termsText: null }))).toBe(true);
  });

  // A shop mid-pause is still, separately, "open" by this predicate's own
  // definition (Stripe keys + returns policy + support email) — pausing
  // doesn't revoke any of those. See `isShopPausedFor` below for the second,
  // independent check a caller composes this with.
  it("stays true while the shop is paused — pausing is not the same gate", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
    expect(isShopOpenFor(settingsWith({ shopPaused: true }))).toBe(true);
  });
});

describe("isShopPausedFor (issue #43)", () => {
  it("is false by default", () => {
    expect(isShopPausedFor(settingsWith({}))).toBe(false);
  });

  it("is true once the owner has flipped the pause switch", () => {
    expect(isShopPausedFor(settingsWith({ shopPaused: true }))).toBe(true);
  });

  it("reads independently of hasPaymentKeys/isShopOpenFor — no Stripe keys needed to be 'paused'", () => {
    // Not a state a real pre-launch shop would be in (nothing here composes
    // the two), but the predicate itself has no such precondition — the
    // page and the checkout route are what decide to check `isShopOpenFor`
    // first, not this function.
    expect(isShopPausedFor(settingsWith({ shopPaused: true }))).toBe(true);
  });
});
