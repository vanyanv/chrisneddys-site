import { describe, it, expect, afterEach, vi } from "vitest";
import { passkeyRpID } from "@/lib/betterAuth";
import { brand } from "@/data/brand";

/**
 * `passkeyRpID` runs inside `buildAuth`, so anything it throws takes the
 * whole `auth` instance with it — `signInEmail`, `getSession` and
 * `requireOwner` included. That would turn a mistyped environment variable
 * into "nobody can reach the admin at all", which is exactly what issue
 * #51's first rule forbids: passkeys are an addition to email+password,
 * never something that can take the password path down with it.
 *
 * So these are not tests of WebAuthn. They are tests that a bad
 * `SITE_ORIGIN` degrades to "passkeys quietly don't work" instead of a
 * lockout.
 */
const PRODUCTION_HOST = new URL(brand.siteUrl).hostname;

afterEach(() => {
  delete process.env.SITE_ORIGIN;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_ENV;
  vi.restoreAllMocks();
});

describe("passkeyRpID", () => {
  it("uses the host of an explicit SITE_ORIGIN", () => {
    process.env.SITE_ORIGIN = "http://localhost:3111";
    expect(passkeyRpID()).toBe("localhost");
  });

  it("drops the port — an RP ID is a bare domain", () => {
    process.env.SITE_ORIGIN = "https://preview.example.com:8443";
    expect(passkeyRpID()).toBe("preview.example.com");
  });

  it("falls back to the production host with nothing set", () => {
    expect(passkeyRpID()).toBe(PRODUCTION_HOST);
  });

  it("survives a SITE_ORIGIN with the scheme left off", () => {
    // `SITE_ORIGIN=chrisneddys.com` is the obvious typo: every other
    // variable in DEPLOY.md is a bare value. `new URL()` rejects it.
    process.env.SITE_ORIGIN = "chrisneddys.com";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(passkeyRpID()).toBe(PRODUCTION_HOST);
    expect(warn).toHaveBeenCalled();
  });

  it("survives a SITE_ORIGIN that parses but has no host", () => {
    // Parses without error, reading `www.chrisneddys.com:` as the scheme,
    // and yields an empty hostname — an empty RP ID the browser would
    // reject at ceremony time with nothing pointing at the cause.
    process.env.SITE_ORIGIN = "www.chrisneddys.com:443";
    expect(new URL(process.env.SITE_ORIGIN).hostname).toBe("");
    expect(passkeyRpID()).toBe(PRODUCTION_HOST);
  });
});
