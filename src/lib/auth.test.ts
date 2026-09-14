import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSessionToken, verifySessionToken } from "@/lib/sessionToken";
import { parseOwnerEmails } from "@/lib/ownerAllowlist";

describe("password hashing", () => {
  it("round-trips: a hash produced by hashPassword verifies against the same password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
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
