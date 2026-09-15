import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSessionToken, verifySessionToken } from "@/lib/sessionToken";
import { parseOwnerEmails } from "@/lib/ownerAllowlist";
import {
  checkIpThrottle,
  checkThrottle,
  MAX_FAILED_ATTEMPTS,
  pruneSignInAttempts,
  recordSignInAttempt,
} from "@/lib/signInThrottle";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

describe("password hashing", () => {
  it("round-trips: a hash produced by hashPassword verifies against the same password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$131072\$[0-9a-f]+\$[0-9a-f]+$/);
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("produces a different salt (and hash) on every call", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("session JWT", () => {
  const secret = "test-secret-do-not-use-in-prod";

  it("round-trips a signed token", async () => {
    const token = await signSessionToken({ email: "owner@example.com", name: "Owner" }, secret);
    const session = await verifySessionToken(token, secret);
    expect(session).toEqual({
      email: "owner@example.com",
      name: "Owner",
      issuedAt: expect.any(Number),
    });
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await signSessionToken({ email: "owner@example.com", name: null }, secret);
    const session = await verifySessionToken(token, "a-different-secret");
    expect(session).toBeNull();
  });

  it("returns null for garbage input", async () => {
    await expect(verifySessionToken("not-a-jwt", secret)).resolves.toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Sign a token whose issuedAt is already 31 days in the past, so its
    // 30-day expiry has already passed.
    const now = Math.floor(Date.now() / 1000);
    const thirtyOneDaysAgo = now - 60 * 60 * 24 * 31;
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({ email: "owner@example.com", name: null })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(thirtyOneDaysAgo)
      .setExpirationTime(thirtyOneDaysAgo + 60 * 60 * 24 * 30)
      .sign(new TextEncoder().encode(secret));

    const session = await verifySessionToken(token, secret);
    expect(session).toBeNull();
  });
});

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

    const signIn = await checkThrottle(db, email, ip, now, "sign_in");
    expect(signIn.locked).toBe(false);
    expect(signIn.ipFailures).toBe(0);
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
