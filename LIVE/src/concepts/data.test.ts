import { describe, it, expect } from "vitest";
import { conceptProject, setCoefficient, evaluateDemo } from "./data";
describe("isolated concept fixture science", () => {
  it("blocks UNKNOWN then evaluates with an explicit demo assumption", () => {
    const p = conceptProject();
    expect(evaluateDemo(p, "r50", ["tank"])).toBeNull();
    const result = evaluateDemo(setCoefficient(p, "z3", 0.3), "r50", [
      "tank",
      "garden",
    ]);
    expect(result?.baseline.rainfallM3).toBe(45);
    expect(result?.baseline.runoffM3).toBeCloseTo(29.85);
    expect(result?.residual).toBeCloseTo(14.85);
    expect(result?.handled).toBe(15);
    expect(result?.area).toBe(21);
    expect(result?.cost).toBe(12_000_000);
  });
  it("keeps capacity bounded by explicitly targeted water and compares another event", () => {
    let p = setCoefficient(conceptProject(), "z3", 0.3);
    p = setCoefficient(p, "z0", 0);
    expect(evaluateDemo(p, "r50", ["tank"])?.handled).toBe(0);
    expect(
      evaluateDemo(setCoefficient(conceptProject(), "z3", 0.3), "r80", [
        "tank",
        "garden",
      ])?.residual,
    ).toBeCloseTo(32.76);
  });
});
