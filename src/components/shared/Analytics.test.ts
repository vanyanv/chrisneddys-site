import { describe, expect, it } from "vitest";
import { shouldTrack } from "@/lib/analytics";

describe("shouldTrack", () => {
  it("tracks the apex production hostname", () => {
    expect(shouldTrack("chrisneddys.com", "")).toBe(true);
  });

  it("tracks any subdomain of the production hostname", () => {
    expect(shouldTrack("www.chrisneddys.com", "")).toBe(true);
    expect(shouldTrack("preview.chrisneddys.com", "")).toBe(true);
  });

  it("does not track localhost", () => {
    expect(shouldTrack("localhost", "")).toBe(false);
  });

  it("does not track a Vercel preview or other non-production host", () => {
    expect(shouldTrack("chrisneddys-site.vercel.app", "")).toBe(false);
  });

  it("does not track a lookalike hostname that merely ends with the domain name", () => {
    expect(shouldTrack("notchrisneddys.com", "")).toBe(false);
  });

  it("the ga_debug flag does not open the gate for a disallowed host", () => {
    expect(shouldTrack("localhost", "?ga_debug=1")).toBe(false);
  });
});
