import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSetupChecklist, webhookUrl } from "@/lib/setupChecklist";

// `setupChecklist.ts` (and the `@/lib/auth` it reads `isAuthConfigured`
// from) both carry `import "server-only"`, which throws outside a real
// Next.js server build — see the note in
// src/app/api/checkout/route.test.ts.
vi.mock("server-only", () => ({}));

const ENV_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "OWNER_EMAILS",
  "OWNER_PASSWORD_HASH",
  "BLOB_READ_WRITE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function itemByKey(items: ReturnType<typeof getSetupChecklist>, key: string) {
  const item = items.find((i) => i.key === key);
  if (!item) throw new Error(`missing checklist item: ${key}`);
  return item;
}

describe("getSetupChecklist", () => {
  it("everything fails closed when no env vars are set", () => {
    for (const item of getSetupChecklist()) {
      expect(item.ok).toBe(false);
    }
  });

  it("Database is ok only once DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgres://example";
    expect(itemByKey(getSetupChecklist(), "database").ok).toBe(true);
  });

  it("Owner sign-in requires all three of AUTH_SECRET, OWNER_EMAILS, OWNER_PASSWORD_HASH", () => {
    process.env.AUTH_SECRET = "s";
    process.env.OWNER_EMAILS = "chris@example.com";
    // OWNER_PASSWORD_HASH still unset.
    expect(itemByKey(getSetupChecklist(), "owner-sign-in").ok).toBe(false);

    process.env.OWNER_PASSWORD_HASH = "scrypt$00$00";
    expect(itemByKey(getSetupChecklist(), "owner-sign-in").ok).toBe(true);
  });

  it("Payments needs both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, and names the missing one", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    // STRIPE_WEBHOOK_SECRET still unset.
    let payments = itemByKey(getSetupChecklist(), "payments");
    expect(payments.ok).toBe(false);
    expect(payments.detail).toContain("STRIPE_WEBHOOK_SECRET");
    expect(payments.detail).not.toContain("STRIPE_SECRET_KEY");

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    payments = itemByKey(getSetupChecklist(), "payments");
    expect(payments.ok).toBe(true);
    expect(payments.detail).toBe("");
  });

  it("Email needs both RESEND_API_KEY and EMAIL_FROM, and names the missing one", () => {
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    // RESEND_API_KEY still unset.
    let email = itemByKey(getSetupChecklist(), "email");
    expect(email.ok).toBe(false);
    expect(email.detail).toContain("RESEND_API_KEY");

    process.env.RESEND_API_KEY = "re_test_fake";
    email = itemByKey(getSetupChecklist(), "email");
    expect(email.ok).toBe(true);
  });

  it("Photo storage is ok only once BLOB_READ_WRITE_TOKEN is set", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_x";
    expect(itemByKey(getSetupChecklist(), "photo-storage").ok).toBe(true);
  });

  it("exposes the Stripe webhook URL built from the brand site URL", () => {
    expect(webhookUrl).toBe("https://www.chrisneddys.com/api/stripe/webhook");
  });
});
