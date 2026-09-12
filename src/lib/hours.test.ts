import { describe, expect, it } from "vitest";
import {
  closingSummary,
  hoursSentence,
  losAngelesNow,
  statusLabel,
  statusParts,
  storeStatus,
} from "@/lib/hours";
import { locations, type Location } from "@/data/locations";

const hollywood = locations.find((l) => l.id === "hollywood") as Location;
const glendale = locations.find((l) => l.id === "glendale") as Location;
const vannuys = locations.find((l) => l.id === "vannuys") as Location;

/** A synthetic store open the same hours every day, to exercise the single-group case. */
const uniform: Location = {
  ...hollywood,
  openingSpec: [
    {
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "11:00",
      closes: "22:00",
    },
  ],
};

// All instants below are UTC, chosen against the real America/Los_Angeles
// offset in effect (PDT, UTC-7) for September 2026 — verified against the
// same Intl.DateTimeFormat the module itself uses.
const at = (iso: string) => new Date(iso);

describe("losAngelesNow", () => {
  it("converts a UTC instant to the LA weekday and minutes-from-midnight", () => {
    // 2026-09-14T17:30:00Z is Monday 10:30 AM in Los Angeles.
    expect(losAngelesNow(at("2026-09-14T17:30:00Z"))).toEqual({
      weekday: "Monday",
      minutes: 10 * 60 + 30,
    });
  });
});

describe("storeStatus", () => {
  it("is open during the day, far from closing", () => {
    const status = storeStatus(hollywood, at("2026-09-14T17:30:00Z")); // Mon 10:30 AM
    expect(status).toMatchObject({ state: "open", closesAt: "1 AM" });
  });

  it("is still open just after midnight, inside the previous day's window", () => {
    const status = storeStatus(hollywood, at("2026-09-15T07:00:00Z")); // Tue 12:00 AM
    expect(status).toEqual({ state: "open", minutesLeft: 60, closesAt: "1 AM" });
  });

  it("switches to last-call inside the final 45 minutes of an after-midnight window", () => {
    const status = storeStatus(hollywood, at("2026-09-15T07:20:00Z")); // Tue 12:20 AM
    expect(status).toEqual({ state: "last-call", minutesLeft: 40, closesAt: "1 AM" });
  });

  it("is closed just after the after-midnight close, and names today's opening", () => {
    const status = storeStatus(hollywood, at("2026-09-15T08:05:00Z")); // Tue 1:05 AM
    expect(status).toEqual({ state: "closed", opensAt: "10 AM" });
  });

  it("is closed before opening, with no leftover window still running", () => {
    const status = storeStatus(hollywood, at("2026-09-14T10:00:00Z")); // Mon 3:00 AM
    expect(status).toEqual({ state: "closed", opensAt: "10 AM" });
  });

  it("keeps a weekday open until 1 AM", () => {
    const status = storeStatus(hollywood, at("2026-09-15T06:00:00Z")); // Mon 11:00 PM
    expect(status).toMatchObject({ state: "open", closesAt: "1 AM" });
  });

  it("keeps a Friday open until the later 2 AM close", () => {
    const status = storeStatus(hollywood, at("2026-09-19T06:00:00Z")); // Fri 11:00 PM
    expect(status).toMatchObject({ state: "open", closesAt: "2 AM" });
  });

  it("reports unknown for a location that is not open yet", () => {
    expect(storeStatus(glendale, at("2026-09-14T17:30:00Z"))).toEqual({ state: "unknown" });
  });
});

describe("statusParts / statusLabel", () => {
  it("formats an open status as a single sentence and label", () => {
    const status = storeStatus(hollywood, at("2026-09-14T17:30:00Z"));
    const parts = statusParts(status);
    expect(parts.aria).toBe("Open until 1 AM");
    expect(statusLabel(status)).toBe("OPEN TILL 1 AM");
  });

  it("formats last-call with the minutes remaining, not a closing time", () => {
    const status = storeStatus(hollywood, at("2026-09-15T07:20:00Z"));
    const parts = statusParts(status);
    expect(parts.aria).toBe("Last call, 40 minutes left");
    expect(statusLabel(status)).toBe("LAST CALL · 40 MIN");
  });

  it("formats closed-with-opening-time and closed-with-none differently", () => {
    const closed = storeStatus(hollywood, at("2026-09-15T08:05:00Z"));
    expect(statusLabel(closed)).toBe("CLOSED · OPENS 10 AM");

    const unknown = storeStatus(glendale, at("2026-09-14T17:30:00Z"));
    expect(statusLabel(unknown)).toBe("");
  });
});

describe("closingSummary / hoursSentence", () => {
  it("groups Hollywood's consecutive days by their shared closing time", () => {
    expect(closingSummary(hollywood)).toBe(
      "1 AM Monday through Thursday, 2 AM Friday through Sunday",
    );
  });

  it("gives Hollywood's full open-to-close line, one clause per group", () => {
    expect(hoursSentence(hollywood)).toBe(
      "10 AM to 1 AM Monday through Thursday, and 10 AM to 2 AM Friday through Sunday",
    );
  });

  it("collapses a single week-round group into one day range", () => {
    expect(closingSummary(uniform)).toBe("10 PM Sunday through Saturday");
    expect(hoursSentence(uniform)).toBe("11 AM to 10 PM Sunday through Saturday");
  });

  it("returns empty strings for a location that isn't open yet, rather than inventing hours", () => {
    expect(closingSummary(glendale)).toBe("");
    expect(hoursSentence(glendale)).toBe("");
    expect(closingSummary(vannuys)).toBe("");
    expect(hoursSentence(vannuys)).toBe("");
  });
});
