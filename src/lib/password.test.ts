import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, verifyPasswordDetailed } from "@/lib/password";

const scryptAsync = promisify(scrypt) as unknown as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: Record<string, unknown>,
) => Promise<Buffer>;

describe("hashPassword", () => {
  it("produces the current 4-field format at N=131072", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$131072\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("produces a different salt (and hash) on every call", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword — current format", () => {
  it("round-trips: a hash produced by hashPassword verifies against the same password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});

describe("verifyPassword — legacy format", () => {
  /** Hashes `password` the old way: scrypt N=16384, r=8, p=1, 64-byte key. */
  async function legacyHash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
  }

  it("a pre-existing 3-field (N=16384) hash still verifies", async () => {
    const hash = await legacyHash("an old owner password");
    await expect(verifyPassword("an old owner password", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password against a legacy hash", async () => {
    const hash = await legacyHash("an old owner password");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});

describe("verifyPasswordDetailed", () => {
  it('A4: reports generation "current" for a hash made by hashPassword', async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPasswordDetailed("correct horse battery staple", hash)).resolves.toEqual({
      ok: true,
      generation: "current",
    });
  });

  it('A4: reports generation "legacy" for an old-format hash, so a caller can rehash it', async () => {
    const salt = randomBytes(16);
    const key = await scryptAsync("an old owner password", salt, 64, { N: 16384, r: 8, p: 1 });
    const legacy = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

    await expect(verifyPasswordDetailed("an old owner password", legacy)).resolves.toEqual({
      ok: true,
      generation: "legacy",
    });
  });

  it("reports generation null on a wrong password or a malformed stored hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPasswordDetailed("wrong password", hash)).resolves.toEqual({
      ok: false,
      generation: null,
    });
    await expect(verifyPasswordDetailed("anything", "not-a-real-hash")).resolves.toEqual({
      ok: false,
      generation: null,
    });
    await expect(verifyPasswordDetailed("anything", "")).resolves.toEqual({
      ok: false,
      generation: null,
    });
  });
});

describe("verifyPassword — malformed input", () => {
  it("rejects a malformed stored hash instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("rejects a 4-field hash whose cost field isn't the current N (unknown generation)", async () => {
    // Same shape as a current hash, but a cost this codebase never produces —
    // parseStoredHash must not silently trust an arbitrary N from storage.
    await expect(
      verifyPassword("anything", `scrypt$4096$${"ab".repeat(16)}$${"cd".repeat(64)}`),
    ).resolves.toBe(false);
  });
});

describe("N=131072 needs a raised maxmem (Node's 32 MiB default is too small)", () => {
  it("crypto.scrypt at N=131072 throws with Node's default maxmem", async () => {
    const salt = randomBytes(16);
    // No `maxmem` override here — this is Node's own default (32 * 1024 * 1024),
    // which is short of the ~128 MiB that N=131072, r=8 requires.
    await expect(scryptAsync("password", salt, 64, { N: 131072, r: 8, p: 1 })).rejects.toThrow();
  });

  it("crypto.scrypt at N=131072 succeeds once maxmem is raised — what hashPassword does", async () => {
    const salt = randomBytes(16);
    const key = await scryptAsync("password", salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 128 * 131072 * 8 * 2,
    });
    expect(key).toHaveLength(64);
  });
});
