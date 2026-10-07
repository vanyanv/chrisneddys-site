import { describe, expect, it } from "vitest";
import { closingNow } from "./clock";
import { businessDate } from "./night";

const REAL = new Date("2026-10-07T20:00:00Z"); // 1 PM PDT Wed Oct 7, business night Oct 7
const PREVIEW = { VERCEL_ENV: "preview", NODE_ENV: "production" };

describe("closingNow", () => {
  it("ignores ?at in production", () => {
    expect(
      closingNow({ at: "00:40" }, REAL, { VERCEL_ENV: "production", NODE_ENV: "production" }),
    ).toBe(REAL);
    expect(closingNow({ at: "00:40" }, REAL, { NODE_ENV: "production" })).toBe(REAL);
  });

  it("returns the real time without ?at or with a bad one", () => {
    expect(closingNow({}, REAL, PREVIEW)).toBe(REAL);
    expect(closingNow({ at: "25:00" }, REAL, PREVIEW)).toBe(REAL);
    expect(closingNow({ at: "soon" }, REAL, PREVIEW)).toBe(REAL);
  });

  it("puts evening times on the night's own calendar day", () => {
    // business night Oct 7; 23:00 PDT Oct 7 = 06:00Z Oct 8
    expect(closingNow({ at: "23:00" }, REAL, PREVIEW).toISOString()).toBe(
      "2026-10-08T06:00:00.000Z",
    );
  });

  it("puts times before 06:00 after midnight, still the same business night", () => {
    const t = closingNow({ at: "00:40" }, REAL, PREVIEW); // 00:40 PDT Oct 8 = 07:40Z
    expect(t.toISOString()).toBe("2026-10-08T07:40:00.000Z");
    expect(businessDate(t)).toBe(businessDate(REAL));
  });

  it("also works in development and with URLSearchParams", () => {
    const t = closingNow(new URLSearchParams("at=1:05"), REAL, { NODE_ENV: "development" });
    expect(t.toISOString()).toBe("2026-10-08T08:05:00.000Z");
  });
});
