import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseOwnerEmails } from "@/lib/ownerAllowlist";
import {
  checkIpThrottle,
  checkThrottle,
  MAX_FAILED_ATTEMPTS,
  pruneSignInAttempts,
  recordSignInAttempt,
} from "@/lib/signInThrottle";

// `@/lib/auth` carries `import "server-only"`, which throws outside a real
// Next.js server build — see the note in `src/app/api/checkout/route.test.ts`.
vi.mock("server-only", () => ({}));

// `signIn` reads/writes the session cookie through `next/headers`, which
// throws when called outside a real Next.js request — see the note above
// `getSessionCookie`'s use in `src/middleware.ts`. A tiny in-memory stand-in
// lets `signIn` run end to end in a unit test; nothing here asserts on the
// stored cookie itself; that's Better Auth's own concern.
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

const { signIn } = await import("@/lib/auth");

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

/** Hashes `password` the old way: scrypt N=16384, r=8, p=1, 64-byte key —
 * what every stored owner password looked like before the Better Auth
 * migration. Mirrors `src/lib/betterAuth.spike.test.ts`'s `legacyHash`. */
async function legacyHash(password: string): Promise<string> {
  const scryptAsync = promisify(scrypt) as unknown as (
    password: string,
    salt: Buffer,
    keylen: number,
    options: Record<string, unknown>,
  ) => Promise<Buffer>;
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

describe("owner email allowlist normalisation", () => {
  it("lowercases and trims each entry", () => {
    expect(parseOwnerEmails(" Chris@Example.com , NED@example.com ")).toEqual([
      "chris@example.com",
      "ned@example.com",
    ]);
  });

  it("drops empty entries from stray commas", () => {
    expect(parseOwnerEmails("a@example.com,,b@example.com,")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("returns an empty list for an empty string or undefined", () => {
    expect(parseOwnerEmails("")).toEqual([]);
    expect(parseOwnerEmails(undefined)).toEqual([]);
  });
});

describe("sign-in throttle", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("locks an email out after 5 failed attempts, not before", async () => {
    const db = await getDb();
    const email = "throttled-email@example.com";
    const ip = "203.0.113.1";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      const status = await checkThrottle(db, email, ip, now);
      expect(status.locked).toBe(false);
      await recordSignInAttempt(db, email, ip, false, now);
    }

    // 4 failures recorded so far — still not locked.
    expect((await checkThrottle(db, email, ip, now)).locked).toBe(false);

    await recordSignInAttempt(db, email, ip, false, now);

    // 5th failure recorded — now locked, with a positive retry hint inside
    // the 15-minute window.
    const locked = await checkThrottle(db, email, ip, now);
    expect(locked.locked).toBe(true);
    expect(locked.emailFailures).toBe(MAX_FAILED_ATTEMPTS);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("a success is never counted, so it can't push an email over the limit", async () => {
    const db = await getDb();
    const email = "success-email@example.com";
    const ip = "203.0.113.2";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordSignInAttempt(db, email, ip, false, now);
    }
    await recordSignInAttempt(db, email, ip, true, now); // the 5th attempt succeeds

    const status = await checkThrottle(db, email, ip, now);
    expect(status.locked).toBe(false);
    expect(status.emailFailures).toBe(MAX_FAILED_ATTEMPTS - 1);
  });

  it("a different email/IP pair is unaffected by another email's failures", async () => {
    const db = await getDb();
    const attackerEmail = "attacker@example.com";
    const attackerIp = "203.0.113.10";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordSignInAttempt(db, attackerEmail, attackerIp, false, now);
    }

    const attacker = await checkThrottle(db, attackerEmail, attackerIp, now);
    expect(attacker.locked).toBe(true);

    // A different email tried from the attacker's IP is also locked (the IP
    // channel is shared)...
    const otherEmailSameIp = await checkThrottle(db, "someone-else@example.com", attackerIp, now);
    expect(otherEmailSameIp.locked).toBe(true);

    // ...but an unrelated email tried from an unrelated IP is not: neither
    // channel has ever seen a failure for this pair.
    const fresh = await checkThrottle(db, "fresh@example.com", "203.0.113.20", now);
    expect(fresh.locked).toBe(false);
    expect(fresh.emailFailures).toBe(0);
    expect(fresh.ipFailures).toBe(0);
  });

  it("ignores failures outside the 15-minute window", async () => {
    const db = await getDb();
    const email = "stale-failures@example.com";
    const ip = "203.0.113.30";
    const longAgo = new Date(now.getTime() - 20 * 60 * 1000);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const db2 = db as unknown as PgliteDatabase<typeof schema>;
      await db2.insert(schema.signInAttempts).values({
        email,
        ip,
        succeeded: false,
        attemptedAt: longAgo,
      });
    }

    const status = await checkThrottle(db, email, ip, now);
    expect(status.locked).toBe(false);
    expect(status.emailFailures).toBe(0);
  });

  it("pruneSignInAttempts deletes rows older than 24h and keeps newer ones", async () => {
    const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
    const email = "prune-me@example.com";
    const ip = "203.0.113.40";
    const veryOld = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 60 * 1000);

    await db
      .insert(schema.signInAttempts)
      .values({ email, ip, succeeded: false, attemptedAt: veryOld });
    await db
      .insert(schema.signInAttempts)
      .values({ email, ip, succeeded: false, attemptedAt: recent });

    await pruneSignInAttempts(db, now);

    const remaining = await db.query.signInAttempts.findMany({
      where: (t, { eq }) => eq(t.email, email),
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.attemptedAt.getTime()).toBe(recent.getTime());
  });
});

describe("attempt throttle kinds", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const MAX_LOOKUP_ATTEMPTS = 10;

  it("sign-in failures don't lock out order lookups for the same IP", async () => {
    const db = await getDb();
    const ip = "203.0.113.50";
    const email = "shopper@example.com";

    // 5 failed sign-ins is enough to lock the "sign_in" kind for this IP...
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordSignInAttempt(db, email, ip, false, now, "sign_in");
    }
    expect((await checkThrottle(db, email, ip, now, "sign_in")).locked).toBe(true);

    // ...but the "order_lookup" kind for the very same IP has no failures.
    const lookup = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup");
    expect(lookup.locked).toBe(false);
    expect(lookup.failures).toBe(0);
  });

  it("order-lookup failures don't lock out sign-in for the same IP", async () => {
    const db = await getDb();
    const ip = "203.0.113.51";
    const email = "shopper2@example.com";

    for (let i = 0; i < MAX_LOOKUP_ATTEMPTS; i++) {
      await recordSignInAttempt(db, email, ip, false, now, "order_lookup");
    }
    const lookup = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup");
    expect(lookup.locked).toBe(true);

    const signInThrottle = await checkThrottle(db, email, ip, now, "sign_in");
    expect(signInThrottle.locked).toBe(false);
    expect(signInThrottle.ipFailures).toBe(0);
  });

  it("locks order lookups for an IP after 10 failed lookups, not before", async () => {
    const db = await getDb();
    const ip = "203.0.113.52";
    const email = "shopper3@example.com";

    for (let i = 0; i < MAX_LOOKUP_ATTEMPTS - 1; i++) {
      const status = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup");
      expect(status.locked).toBe(false);
      await recordSignInAttempt(db, email, ip, false, now, "order_lookup");
    }

    // 9 failures recorded — still not locked.
    expect((await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup")).locked).toBe(
      false,
    );

    await recordSignInAttempt(db, email, ip, false, now, "order_lookup");

    // 10th failure — now locked, with a positive retry hint inside the
    // 15-minute window.
    const locked = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup");
    expect(locked.locked).toBe(true);
    expect(locked.failures).toBe(MAX_LOOKUP_ATTEMPTS);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("a successful order lookup is never counted as a failure", async () => {
    const db = await getDb();
    const ip = "203.0.113.53";
    const email = "shopper4@example.com";

    for (let i = 0; i < MAX_LOOKUP_ATTEMPTS - 1; i++) {
      await recordSignInAttempt(db, email, ip, false, now, "order_lookup");
    }
    await recordSignInAttempt(db, email, ip, true, now, "order_lookup"); // the 10th lookup hits

    const status = await checkIpThrottle(db, ip, MAX_LOOKUP_ATTEMPTS, now, "order_lookup");
    expect(status.locked).toBe(false);
    expect(status.failures).toBe(MAX_LOOKUP_ATTEMPTS - 1);
  });
});

describe("signIn: bootstrap the first owner account", () => {
  const originalSecret = process.env.AUTH_SECRET;
  const originalEmails = process.env.OWNER_EMAILS;
  const originalHash = process.env.OWNER_PASSWORD_HASH;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-bootstrap";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    if (originalEmails === undefined) delete process.env.OWNER_EMAILS;
    else process.env.OWNER_EMAILS = originalEmails;
    if (originalHash === undefined) delete process.env.OWNER_PASSWORD_HASH;
    else process.env.OWNER_PASSWORD_HASH = originalHash;
  });

  it("seeds the first account from OWNER_EMAILS/OWNER_PASSWORD_HASH, then ignores the env vars for good", async () => {
    const email = "bootstrap-owner@example.com";
    const password = "correct bootstrap password!!";
    process.env.OWNER_EMAILS = email;
    process.env.OWNER_PASSWORD_HASH = await hashPassword(password);

    // With an empty `user` table, this is the very first sign-in attempt —
    // it must both create the account and sign it in.
    const first = await signIn(email, password, "203.0.113.60");
    expect(first).toEqual({ ok: true });

    const db = await getDb();
    const seeded = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });
    expect(seeded).toHaveLength(1);

    // Now that `user` has a row, OWNER_EMAILS/OWNER_PASSWORD_HASH are
    // ignored entirely — a different email that's in the (changed) env var
    // is never seeded, and signing in with it fails.
    const otherEmail = "never-seeded@example.com";
    const otherPassword = "some other password!!";
    process.env.OWNER_EMAILS = otherEmail;
    process.env.OWNER_PASSWORD_HASH = await hashPassword(otherPassword);

    const second = await signIn(otherEmail, otherPassword, "203.0.113.61");
    expect(second.ok).toBe(false);

    const stillNoOtherAccount = await db.query.user.findMany({
      where: (t, { eq }) => eq(t.email, otherEmail),
    });
    expect(stillNoOtherAccount).toHaveLength(0);
  });

  it("does not seed an account for an email outside OWNER_EMAILS, even with an empty user table", async () => {
    process.env.OWNER_EMAILS = "allowlisted@example.com";
    process.env.OWNER_PASSWORD_HASH = await hashPassword("whatever password!!");

    const result = await signIn(
      "not-allowlisted@example.com",
      "whatever password!!",
      "203.0.113.62",
    );
    expect(result.ok).toBe(false);

    const db = await getDb();
    const rows = await db.query.user.findMany({
      where: (t, { eq }) => eq(t.email, "not-allowlisted@example.com"),
    });
    expect(rows).toHaveLength(0);
  });
});

describe("signIn: legacy password rehash", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-rehash";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  });

  it("rehashes a legacy-format password to the current format after a successful sign-in", async () => {
    const db = await getDb();
    const email = "legacy-rehash-owner@example.com";
    const password = "a legacy owner password!!";
    const userId = "legacy-rehash-user-id";

    await db
      .insert(schema.user)
      .values({ id: userId, name: "Legacy Owner", email, emailVerified: false });
    const originalHash = await legacyHash(password);
    await db.insert(schema.account).values({
      id: "legacy-rehash-account-id",
      accountId: userId,
      providerId: "credential",
      userId,
      password: originalHash,
    });

    const result = await signIn(email, password, "203.0.113.70");
    expect(result).toEqual({ ok: true });

    const [row] = await db.query.account.findMany({ where: (t, { eq }) => eq(t.userId, userId) });
    expect(row?.password).not.toBe(originalHash);
    expect(row?.password).toMatch(/^scrypt\$131072\$[0-9a-f]+\$[0-9a-f]+$/);

    // The rehashed value still verifies the same plaintext password.
    await expect(verifyPassword(password, row!.password!)).resolves.toBe(true);
  });

  it("leaves an already-current-format password untouched", async () => {
    const db = await getDb();
    const email = "current-format-owner@example.com";
    const password = "already current format password!!";
    const userId = "current-format-user-id";

    await db
      .insert(schema.user)
      .values({ id: userId, name: "Current Owner", email, emailVerified: false });
    const currentHash = await hashPassword(password);
    await db.insert(schema.account).values({
      id: "current-format-account-id",
      accountId: userId,
      providerId: "credential",
      userId,
      password: currentHash,
    });

    const result = await signIn(email, password, "203.0.113.71");
    expect(result).toEqual({ ok: true });

    const [row] = await db.query.account.findMany({ where: (t, { eq }) => eq(t.userId, userId) });
    expect(row?.password).toBe(currentHash);
  });
});
