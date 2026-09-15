/**
 * Proves the properties `requestPasswordResetAction` has to hold:
 *
 * - No account enumeration: a known owner's email and a completely unknown
 *   one get back the exact same `{ sent, message }` shape, byte for byte —
 *   including while throttled.
 * - The one legitimate exception: when Resend isn't configured
 *   (RESEND_API_KEY / EMAIL_FROM unset), the page says so plainly — and
 *   that message shows up the same way for a known email too, so it's about
 *   the site's own configuration, never about whether the address exists.
 * - Throttling: flooding the form locks it out after the same number of
 *   attempts `src/lib/signInThrottle.ts` uses for sign-in, under its own
 *   `"password_reset"` kind — a bucket independent of `"sign_in"`, so
 *   flooding this form can never lock an owner out of signing in.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { checkThrottle, MAX_FAILED_ATTEMPTS, SIGN_IN_KIND } from "@/lib/signInThrottle";

// `requestPasswordResetAction` now throttles through `resolveClientIp`
// (`@/lib/auth`), which carries `import "server-only"` and reads the
// client IP via `next/headers` — both throw outside a real Next.js request.
// Mocked the same way `src/lib/auth.test.ts` and
// `admin/orders/[id]/actions.test.ts` do it. `ipState` is settable per test
// so the throttle tests below can each use their own IP bucket, isolated
// from the anti-enumeration tests, which all resolve to the "unknown"
// fallback (no `x-forwarded-for` header).
const ipState = vi.hoisted(() => ({ ip: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(ipState.ip ? { "x-forwarded-for": ipState.ip } : {}),
}));

const { requestPasswordResetAction } = await import("./actions");
const { getAuth } = await import("@/lib/betterAuth");

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

const KNOWN_EMAIL = "known-owner@example.com";
const UNKNOWN_EMAIL = "nobody-here@example.com";
const THROTTLE_OWNER_EMAIL = "throttle-owner@example.com";
const THROTTLE_UNKNOWN_EMAIL = "throttle-unknown@example.com";
const THROTTLE_IP = "203.0.113.77";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });

  const auth = await getAuth();
  await auth.api.signUpEmail({
    body: { name: "Known Owner", email: KNOWN_EMAIL, password: "a real owner password!!" },
  });
  await auth.api.signUpEmail({
    body: {
      name: "Throttle Owner",
      email: THROTTLE_OWNER_EMAIL,
      password: "another real owner password!!",
    },
  });
});

const EMAIL_ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  ipState.ip = undefined;
  for (const key of EMAIL_ENV_KEYS) originalEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function formDataFor(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("requestPasswordResetAction", () => {
  it("responds identically for a known owner and an unknown address", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "owner@chrisneddys.com";

    const knownResult = await requestPasswordResetAction(undefined, formDataFor(KNOWN_EMAIL));
    const unknownResult = await requestPasswordResetAction(undefined, formDataFor(UNKNOWN_EMAIL));

    expect(knownResult).toEqual(unknownResult);
    expect(knownResult).toEqual({
      sent: true,
      message: "If that address belongs to an owner, a reset link is on its way.",
    });
  });

  it("says plainly that emailing isn't set up when RESEND_API_KEY/EMAIL_FROM are unset — for a known email too, not just an unknown one", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    const knownResult = await requestPasswordResetAction(undefined, formDataFor(KNOWN_EMAIL));
    const unknownResult = await requestPasswordResetAction(undefined, formDataFor(UNKNOWN_EMAIL));

    // Still identical between known and unknown — the difference here is
    // about configuration, not about whether the account exists.
    expect(knownResult).toEqual(unknownResult);
    expect(knownResult.sent).toBeUndefined();
    expect(knownResult.error).toMatch(/emailing isn't set up/i);
  });

  it("requires a non-empty email before touching configuration or the database", async () => {
    const result = await requestPasswordResetAction(undefined, formDataFor(""));
    expect(result).toEqual({ error: "Enter your email address." });
  });

  it("throttles after the same number of attempts sign-in uses, identically for a known and unknown address", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "owner@chrisneddys.com";
    ipState.ip = THROTTLE_IP;

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const result = await requestPasswordResetAction(undefined, formDataFor(THROTTLE_OWNER_EMAIL));
      expect(result.sent).toBe(true);
    }

    const knownThrottled = await requestPasswordResetAction(
      undefined,
      formDataFor(THROTTLE_OWNER_EMAIL),
    );
    expect(knownThrottled.sent).toBeUndefined();
    expect(knownThrottled.error).toBe("Too many requests for that address. Try again later.");

    // Same IP, a different (unknown) address: the shared IP bucket is
    // already locked, and the response has to be byte-for-byte the same as
    // the known owner's — a throttle message can never depend on whether
    // the address exists.
    const unknownThrottled = await requestPasswordResetAction(
      undefined,
      formDataFor(THROTTLE_UNKNOWN_EMAIL),
    );
    expect(unknownThrottled).toEqual(knownThrottled);
  });

  it("throttles the password_reset kind independently of sign_in — the owner can still sign in", async () => {
    const db = await getDb();

    // The previous test locked THROTTLE_OWNER_EMAIL + THROTTLE_IP under the
    // "password_reset" kind. Sign-in's own kind must not see any of that.
    const signInStatus = await checkThrottle(
      db,
      THROTTLE_OWNER_EMAIL,
      THROTTLE_IP,
      new Date(),
      SIGN_IN_KIND,
    );
    expect(signInStatus).toEqual({
      locked: false,
      retryAfterSeconds: 0,
      emailFailures: 0,
      ipFailures: 0,
    });
  });
});
