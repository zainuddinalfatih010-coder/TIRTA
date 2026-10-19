import { describe, expect, it } from "vitest";
import { formatRupiahEdit, numberChange, rupiahCanonical, rupiahText } from "./planningNumbers";

describe("editable rupiah amounts", () => {
  it("round-trips zero, unknown, millions and fractional rupiah without rounding", () => {
    for (const raw of ["", "0", "1200000", "1200000.50", "0.001", "1234567890123.456"]) {
      expect(rupiahCanonical(rupiahText(raw))).toBe(raw);
    }
    expect(rupiahText("1200000")).toBe("1.200.000");
  });
  it("rejects ambiguous or corrupt pasted amounts rather than inventing a valid number", () => {
    for (const raw of ["1.5", "-100", "1,200,000", "1.200x", "NaN", "1e6", "12.34.567"]) {
      expect(rupiahCanonical(raw)).toBe("invalid-rupiah");
    }
  });
  it("keeps editing position through grouping and preserves decimal entry", () => {
    expect(formatRupiahEdit("1200000", 7)).toEqual({ text: "1.200.000", caret: 9 });
    expect(formatRupiahEdit("19.200.000", 2)).toEqual({ text: "19.200.000", caret: 2 });
    expect(formatRupiahEdit("1.200.000,", 10)).toEqual({ text: "1.200.000,", caret: 10 });
    expect(formatRupiahEdit("1.200x", 6)).toEqual({ text: "1.200x", caret: 6 });
  });
});
describe("draft change summary", () => {
  it("shows only changes, with signed cost and area deltas", () => {
    expect(numberChange("1200000", "1700000", "Rp")?.delta).toBe("+Rp500.000");
    expect(numberChange("1200000", "700000", "Rp")?.delta).toBe("−Rp500.000");
    expect(numberChange("2", "3", "m²")?.delta).toBe("+1 m²");
    expect(numberChange("0.2", "0.3", "m²")?.delta).toBe("+0,1 m²");
    expect(numberChange("2", "2.00", "m²")).toBeNull();
  });
  it("does not subtract UNKNOWN or invalid values as zero", () => {
    expect(numberChange("", "0", "Rp")).toMatchObject({ before: "Belum diketahui", after: "Rp0", delta: "Angka baru" });
    expect(numberChange("2000000", "", "Rp")?.delta).toBe("Menjadi belum diketahui");
    expect(numberChange("0", "invalid-rupiah", "Rp")?.delta).toBe("Belum dapat dibandingkan");
    expect(numberChange("", "", "Rp")).toBeNull();
  });
});
