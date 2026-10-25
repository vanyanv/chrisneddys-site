import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatTimeLA,
  nightLabel,
  parseLang,
  normalizeTemp,
  parseTemp,
  sectionLabel,
  tempOver,
} from "./crewText";

describe("crew text helpers", () => {
  it("parses the language, defaulting to English", () => {
    expect(parseLang("es")).toBe("es");
    expect(parseLang("fr")).toBe("en");
    expect(parseLang(undefined)).toBe("en");
  });

  it("translates only the three starter sections", () => {
    expect(sectionLabel("Kitchen", "es")).toBe("Cocina");
    expect(sectionLabel("Front and restrooms", "es")).toBe("Frente y baños");
    expect(sectionLabel("Lock-up", "es")).toBe("Cerrar el local");
    expect(sectionLabel("Patio", "es")).toBe("Patio");
    expect(sectionLabel("Kitchen", "en")).toBe("Kitchen");
  });

  it("parses temperatures strictly", () => {
    expect(parseTemp("38")).toBe(38);
    expect(parseTemp(" 38,5 ")).toBe(38.5);
    expect(parseTemp("-4")).toBe(-4);
    expect(parseTemp("")).toBeNull();
    expect(parseTemp("abc")).toBeNull();
    expect(parseTemp("38abc")).toBeNull();
    expect(parseTemp(undefined)).toBeNull();
  });

  it("normalises comma decimals to a string the server can store", () => {
    expect(normalizeTemp("38,5")).toBe("38.5");
    expect(Number(normalizeTemp("38,5"))).toBe(38.5);
    expect(normalizeTemp(" 40 ")).toBe("40");
    expect(normalizeTemp("3,8,5")).toBeNull();
    expect(normalizeTemp(null)).toBeNull();
  });

  it("flags a temperature over the limit", () => {
    expect(tempOver("42", 41)).toBe(true);
    expect(tempOver("41", 41)).toBe(false);
    expect(tempOver("", 41)).toBe(false);
    expect(tempOver("50", null)).toBe(false);
  });

  it("formats times in Los Angeles", () => {
    expect(formatTimeLA(new Date("2026-10-07T08:00:00Z"))).toBe("1:00 AM");
    expect(formatTimeLA(new Date("2026-10-07T07:30:00Z"))).toBe("12:30 AM");
  });

  it("labels the night in both languages", () => {
    expect(nightLabel("2026-10-06", "en")).toBe("Tue Oct 6 night");
    expect(nightLabel("2026-10-06", "es")).toBe("noche del martes 6 oct");
  });

  it("formats durations", () => {
    expect(formatDuration(3_725_000)).toBe("1h 02m 05s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(-5)).toBe("0m 00s");
    expect(formatDuration(3_725_000, false)).toBe("1h 2m");
  });
});
