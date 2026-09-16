import { describe, it, expect } from "vitest";
import { redactEmail } from "@/lib/logRedaction";

describe("redactEmail", () => {
  it("keeps the first character and the domain, and hides the rest", () => {
    expect(redactEmail("owner@example.com")).toBe("o***@example.com");
    expect(redactEmail("a@b.co")).toBe("a***@b.co");
  });

  it("never reveals how long the local part was", () => {
    expect(redactEmail("ab@example.com")).toBe(redactEmail("abcdefghij@example.com"));
  });

  it("passes the passkey throttle sentinel through untouched", () => {
    // `passkey-unknown:<ip>` is a throttle key, not an address — mangling
    // it would make the log line harder to match against the throttle.
    expect(redactEmail("passkey-unknown:203.0.113.7")).toBe("passkey-unknown:203.0.113.7");
  });

  it("leaves anything that isn't a single-@ address alone", () => {
    expect(redactEmail("")).toBe("");
    expect(redactEmail("@example.com")).toBe("@example.com");
    expect(redactEmail("owner@")).toBe("owner@");
    expect(redactEmail("a@b@c")).toBe("a@b@c");
  });
});
