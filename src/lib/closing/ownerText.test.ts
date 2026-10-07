import { describe, expect, it } from "vitest";
import type { Check, CheckItem, HistoryNight, ItemStats } from "./checks";
import {
  checkSummary,
  crewStatus,
  dateLabel,
  dotLabel,
  itemStatus,
  latestResolved,
  nightPill,
  parseItemForm,
  rankByMissed,
  sentLabel,
  streakCaption,
  tempTag,
} from "./ownerText";
import { qrDrawing } from "./qr";

const ci = (over: Partial<CheckItem>): CheckItem => ({
  id: "x",
  checkId: "c",
  itemId: "i",
  section: "Kitchen",
  label: "Grill",
  labelEs: "Parrilla",
  kind: "check",
  maxValue: null,
  value: null,
  done: true,
  position: 0,
  ...over,
});
const check = (items: CheckItem[], lang = "en"): Check =>
  ({ id: "c", lang, items, note: null, crewName: "Ana", submittedAt: new Date() }) as Check;
const night = (c: Check | null, windowEnded = true, date = "2026-10-06"): HistoryNight => ({
  date,
  check: c,
  windowEnded,
});

describe("night summaries", () => {
  it("labels dates", () => {
    expect(dateLabel("2026-10-06")).toBe("Tue Oct 6");
  });

  it("summarises missed and over-temperature items", () => {
    const c = check([
      ci({ done: false }),
      ci({ kind: "temp", maxValue: 41, value: "45" }),
      ci({ kind: "temp", maxValue: 41, value: "38" }),
    ]);
    const s = checkSummary(c);
    expect(s.missed).toHaveLength(1);
    expect(s.over).toHaveLength(1);
  });

  it("picks the pill", () => {
    expect(nightPill(night(null)).text).toBe("No check");
    expect(nightPill(night(null, false))).toEqual({ tone: "wait", text: "Not yet" });
    expect(nightPill(night(check([ci({}), ci({ done: false })]))).text).toBe("1 missed");
    expect(nightPill(night(check([ci({ kind: "temp", maxValue: 41, value: "50" })]))).tone).toBe(
      "over",
    );
    expect(nightPill(night(check([ci({})]))).text).toBe("All done");
  });

  it("shows the wording as sent", () => {
    expect(sentLabel({ lang: "es" }, ci({}))).toBe("Parrilla");
    expect(sentLabel({ lang: "es" }, ci({ labelEs: null }))).toBe("Grill");
    expect(sentLabel({ lang: "en" }, ci({}))).toBe("Grill");
  });

  it("skips an unfinished tonight when picking the latest result", () => {
    const tonight = night(null, false, "2026-10-07");
    const last = night(check([ci({})]));
    expect(latestResolved([tonight, last])).toBe(last);
    expect(latestResolved([tonight])).toBeNull();
    const done = night(check([ci({})]), false, "2026-10-07");
    expect(latestResolved([done, last])).toBe(done);
  });
});

describe("item dots", () => {
  const stats = (sequence: ItemStats["sequence"], streak = 0, missed = 0): ItemStats =>
    ({ sequence, streak, missed }) as ItemStats;

  it("describes streaks", () => {
    expect(streakCaption(stats(["none", "none"]))).toBe("No checks yet");
    expect(streakCaption(stats(["none", "done", "done", "missed"], 2))).toBe("2 in a row");
    expect(streakCaption(stats(["missed", "done"]))).toBe("missed last time");
    expect(streakCaption(stats(["over", "done"]))).toBe("over temperature last time");
  });

  it("names a dot", () => {
    expect(dotLabel("2026-10-06", "over")).toBe("Tue Oct 6: over temperature");
  });

  it("ranks by missed, keeping list order for ties", () => {
    const a = stats([], 0, 1);
    const b = stats([], 0, 3);
    const c = stats([], 0, 1);
    expect(rankByMissed([a, b, c])).toEqual([b, a, c]);
  });

  it("tags temperature items", () => {
    expect(tempTag({ kind: "temp", maxValue: 41 })).toBe("Temp ≤ 41°F");
    expect(tempTag({ kind: "check", maxValue: null })).toBeNull();
  });
});

describe("parseItemForm", () => {
  const form = (o: Record<string, string>) => (name: string) => o[name] ?? "";
  const areas = ["Kitchen", "Lock-up"];

  it("requires wording and an area", () => {
    const r = parseItemForm(form({}), areas);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["label", "section"]);
  });

  it("builds an input, blanks become null", () => {
    const r = parseItemForm(
      form({ label: " Shake machine ", section: "Kitchen", kind: "check", labelEs: " " }),
      areas,
    );
    expect(r).toEqual({
      ok: true,
      input: {
        section: "Kitchen",
        label: "Shake machine",
        labelEs: null,
        detail: null,
        detailEs: null,
        kind: "check",
        maxValue: null,
      },
    });
  });

  it("creates a new area, matching an old one case-insensitively", () => {
    const fresh = parseItemForm(
      form({ label: "A", section: "__new", newSection: "Drive-thru" }),
      areas,
    );
    expect(fresh.ok && fresh.input.section).toBe("Drive-thru");
    const same = parseItemForm(
      form({ label: "A", section: "__new", newSection: "kitchen" }),
      areas,
    );
    expect(same.ok && same.input.section).toBe("Kitchen");
    expect(parseItemForm(form({ label: "A", section: "__new" }), areas).ok).toBe(false);
  });

  it("checks temperature limits", () => {
    const base = { label: "Cooler", section: "Kitchen", kind: "temp" };
    const dflt = parseItemForm(form(base), areas);
    expect(dflt.ok && dflt.input.maxValue).toBe(41);
    expect(parseItemForm(form({ ...base, maxValue: "38" }), areas).ok).toBe(true);
    const zero = parseItemForm(form({ ...base, maxValue: "0" }), areas);
    expect(zero.ok && zero.input.maxValue).toBe(0);
    const neg = parseItemForm(form({ ...base, maxValue: "-20" }), areas);
    expect(neg.ok && neg.input.maxValue).toBe(-20);
    expect(parseItemForm(form({ ...base, maxValue: "-21" }), areas).ok).toBe(false);
    expect(parseItemForm(form({ ...base, maxValue: "99" }), areas).ok).toBe(true);
    expect(parseItemForm(form({ ...base, maxValue: "100" }), areas).ok).toBe(false);
    expect(parseItemForm(form({ ...base, maxValue: "cold" }), areas).ok).toBe(false);
    expect(parseItemForm(form({ ...base, maxValue: "38.5" }), areas).ok).toBe(false);
  });
});

describe("status lines", () => {
  it("words item and crew messages", () => {
    expect(itemStatus("up")).toBe("Moved up.");
    expect(itemStatus("nope")).toBeNull();
    const maria = { name: "Maria", code: "6699" };
    expect(crewStatus("added", maria)).toBe("Maria's code is 6699.");
    expect(crewStatus("off", maria)).toBe("Maria's code no longer works.");
    expect(crewStatus("added", null)).toBeNull();
    expect(crewStatus("link", null)).toBe("New link made. Print the new sign.");
  });
});

describe("qrDrawing", () => {
  it("draws a square grid of dark modules", () => {
    const q = qrDrawing("https://www.chrisneddys.com/close/abc/");
    expect(q.size).toBeGreaterThanOrEqual(21);
    expect(q.path.startsWith("M")).toBe(true);
    expect(q.path.match(/M/g)!.length).toBeGreaterThan(q.size);
  });
});
