import { afterEach, describe, expect, it } from "vitest";
import { brand } from "@/data/brand";
import { getSiteOrigin, absoluteUrl } from "@/lib/siteOrigin";

const ENV_KEYS = ["SITE_ORIGIN", "VERCEL_URL", "VERCEL_ENV"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("getSiteOrigin", () => {
  it("falls back to brand.siteUrl with nothing set", () => {
    expect(getSiteOrigin()).toBe(brand.siteUrl);
  });

  it("prefers the SITE_ORIGIN override over everything else", () => {
    process.env.SITE_ORIGIN = "http://127.0.0.1:3111";
    process.env.VERCEL_URL = "my-preview-123.vercel.app";
    process.env.VERCEL_ENV = "preview";
    expect(getSiteOrigin()).toBe("http://127.0.0.1:3111");
  });

  it("strips a trailing slash from the override", () => {
    process.env.SITE_ORIGIN = "http://127.0.0.1:3111/";
    expect(getSiteOrigin()).toBe("http://127.0.0.1:3111");
  });

  it("uses VERCEL_URL on a preview deployment", () => {
    process.env.VERCEL_URL = "my-preview-123.vercel.app";
    process.env.VERCEL_ENV = "preview";
    expect(getSiteOrigin()).toBe("https://my-preview-123.vercel.app");
  });

  it("ignores VERCEL_URL in production, using brand.siteUrl instead", () => {
    process.env.VERCEL_URL = "chrisneddys-site.vercel.app";
    process.env.VERCEL_ENV = "production";
    expect(getSiteOrigin()).toBe(brand.siteUrl);
  });

  it("falls back to brand.siteUrl when VERCEL_URL is set but VERCEL_ENV is unset", () => {
    // No VERCEL_ENV at all (e.g. running outside Vercel) is not "preview",
    // so this stays on the production default rather than guessing.
    process.env.VERCEL_URL = "some-host.vercel.app";
    expect(getSiteOrigin()).toBe(brand.siteUrl);
  });
});

describe("absoluteUrl", () => {
  it("joins the origin and path with exactly one slash", () => {
    expect(absoluteUrl("/admin/reset-password/?token=abc")).toBe(
      `${brand.siteUrl}/admin/reset-password/?token=abc`,
    );
  });

  it("adds the leading slash itself if the path is missing one", () => {
    expect(absoluteUrl("admin/reset-password/")).toBe(`${brand.siteUrl}/admin/reset-password/`);
  });

  it("never produces a double slash at the join, even with an overridden origin", () => {
    process.env.SITE_ORIGIN = "http://127.0.0.1:3111/";
    expect(absoluteUrl("/admin/reset-password/?token=abc")).toBe(
      "http://127.0.0.1:3111/admin/reset-password/?token=abc",
    );
  });
});
