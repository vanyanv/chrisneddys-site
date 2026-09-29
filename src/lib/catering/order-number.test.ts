import { describe, expect, it } from "vitest";
import { formatCateringNumber } from "./order-number";

describe("formatCateringNumber", () => {
  it("formats the sequence number as CAT-NNNN", () => {
    expect(formatCateringNumber(1001)).toBe("CAT-1001");
    expect(formatCateringNumber(1042)).toBe("CAT-1042");
  });
});
