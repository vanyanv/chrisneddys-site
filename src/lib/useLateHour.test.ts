import { describe, expect, it } from "vitest";
import { lateHourState } from "@/lib/useLateHour";
import { locations, type Location } from "@/data/locations";

const hollywood = locations.find((l) => l.id === "hollywood") as Location;

// All instants below are UTC, chosen against the real America/Los_Angeles
// offset in effect (PDT, UTC-7) for September 2026 — the same convention
// `hours.test.ts` uses. Hollywood serves 10 AM to 1 AM Mon-Thu, 10 AM to 2 AM
// Fri-Sun (`src/data/locations.ts`).
const at = (iso: string) => new Date(iso);

describe("lateHourState", () => {
  it("is awake and not blacklit at 3 PM", () => {
    // 2026-09-14T22:00:00Z is Monday 3 PM in Los Angeles.
    expect(lateHourState(hollywood, at("2026-09-14T22:00:00Z"))).toEqual({
      closed: false,
      blacklight: false,
    });
  });

  it("is asleep well before opening", () => {
    // 2026-09-14T13:00:00Z is Monday 6 AM in Los Angeles.
    expect(lateHourState(hollywood, at("2026-09-14T13:00:00Z"))).toEqual({
      closed: true,
      blacklight: false,
    });
  });

  it("is asleep in the afternoon gap the day already closed", () => {
    // 2026-09-14T20:00:00Z is Monday 1 PM in Los Angeles — well inside the
    // 10 AM-1 AM window, so this doubles as an "open, not blacklit" check.
    expect(lateHourState(hollywood, at("2026-09-14T20:00:00Z"))).toEqual({
      closed: false,
      blacklight: false,
    });
  });

  it("turns blacklit at 10 PM while still serving", () => {
    // 2026-09-15T05:00:00Z is Monday 10 PM in Los Angeles.
    expect(lateHourState(hollywood, at("2026-09-15T05:00:00Z"))).toEqual({
      closed: false,
      blacklight: true,
    });
  });

  it("stays blacklit into last call, right up to close", () => {
    // 2026-09-15T07:45:00Z is Tuesday 12:45 AM in Los Angeles — 15 minutes
    // from Monday's 1 AM close, inside last call.
    expect(lateHourState(hollywood, at("2026-09-15T07:45:00Z"))).toEqual({
      closed: false,
      blacklight: true,
    });
  });

  it("goes back to asleep, not blacklit, once the store has closed", () => {
    // 2026-09-15T08:30:00Z is Tuesday 1:30 AM in Los Angeles, past the 1 AM
    // close and before Tuesday's 10 AM open.
    expect(lateHourState(hollywood, at("2026-09-15T08:30:00Z"))).toEqual({
      closed: true,
      blacklight: false,
    });
  });

  it("is blacklit on a Friday night into the 2 AM close", () => {
    // 2026-09-19T08:30:00Z is Saturday 1:30 AM in Los Angeles, inside
    // Friday's 10 AM-2 AM window and inside last call.
    expect(lateHourState(hollywood, at("2026-09-19T08:30:00Z"))).toEqual({
      closed: false,
      blacklight: true,
    });
  });
});
