/**
 * Proves the two properties `requestPasswordResetAction` has to hold:
 *
 * - No account enumeration: a known owner's email and a completely unknown
 *   one get back the exact same `{ sent, message }` shape, byte for byte.
 * - The one legitimate exception: when Resend isn't configured
 *   (RESEND_API_KEY / EMAIL_FROM unset), the page says so plainly — and
 *   that message shows up the same way for a known email too, so it's about
 *   the site's own configuration, never about whether the address exists.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { requestPasswordResetAction } from "./actions";

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

const KNOWN_EMAIL = "known-owner@example.com";
const UNKNOWN_EMAIL = "nobody-here@example.com";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });

  const auth = await getAuth();
  await auth.api.signUpEmail({
    body: { name: "Known Owner", email: KNOWN_EMAIL, password: "a real owner password!!" },
  });
});

const EMAIL_ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
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
});
