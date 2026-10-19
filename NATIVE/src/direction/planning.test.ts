import { describe, expect, it } from "vitest";
import {
  alternatives,
  demoProject,
  dominates,
  evaluate,
  initialSnapshot,
  snapshotSchema,
  updateParameter,
} from "./planning";
const limits = { budget: 12_000_000, land: 24 };
describe("isolated finite demo planning", () => {
  it("blocks unknown and missing rain source without numeric output", () => {
    expect(evaluate(demoProject(), "r50", ["tank"], limits)).toBeNull();
    expect(
      evaluate(
        updateParameter(demoProject(true), "rain-50", 50, ""),
        "r50",
        ["tank"],
        limits,
      ),
    ).toBeNull();
  });
  it("conserves hand-calculated event volumes without double counting", () => {
    const r = evaluate(demoProject(true), "r50", ["tank", "garden"], limits)!;
    expect(r.baseline.rainfallM3).toBe(45);
    expect(r.baseline.runoffM3).toBeCloseTo(29.85);
    expect(r.retained).toBe(6);
    expect(r.infiltrated).toBe(9);
    expect(r.reused).toBe(0);
    expect(r.residual).toBeCloseTo(14.85);
    expect(r.residual + r.retained + r.infiltrated + r.reused).toBeCloseTo(
      r.baseline.runoffM3,
    );
    expect(
      evaluate(demoProject(true), "r80", ["tank", "garden"], limits)?.residual,
    ).toBeCloseTo(32.76);
  });
  it("caps at assigned zone runoff even for zero rain", () => {
    const low = evaluate(
      updateParameter(demoProject(true), "rain-50", 10),
      "r50",
      ["tank", "garden"],
      limits,
    )!;
    expect(low.retained).toBeCloseTo(3.24);
    expect(low.infiltrated).toBeCloseTo(1.92);
    expect(low.residual).toBeCloseTo(0.81);
    expect(
      evaluate(
        updateParameter(demoProject(true), "rain-50", 0),
        "r50",
        ["tank", "garden"],
        limits,
      )?.residual,
    ).toBe(0);
  });
  it("keeps equality feasible, excludes violations and unknown constraints", () => {
    expect(
      evaluate(demoProject(true), "r50", ["tank", "garden"], {
        budget: 12_000_000,
        land: 21,
      })?.feasible,
    ).toBe(true);
    expect(
      evaluate(demoProject(true), "r50", ["tank", "garden"], {
        budget: 11_999_999.99,
        land: 21,
      })?.feasible,
    ).toBe(false);
    expect(
      evaluate(demoProject(true), "r50", ["tank"], { budget: null, land: 24 })
        ?.feasible,
    ).toBe(false);
  });
  it("enumerates four stable choices, retains trade-offs and filters dominated choices", () => {
    const a = alternatives(demoProject(true), "r50", limits);
    expect(a.map((r) => r.id)).toEqual(["none", "tank", "garden", "both"]);
    expect(a.every((r) => r.nonDominated)).toBe(true);
    expect(alternatives(demoProject(true), "r50", limits)).toEqual(a);
    const zero = alternatives(
      updateParameter(demoProject(true), "rain-50", 0),
      "r50",
      limits,
    );
    expect(zero.filter((r) => r.nonDominated).map((r) => r.id)).toEqual([
      "none",
    ]);
    expect(dominates(a[1]!.result!, a[1]!.result!)).toBe(false);
    expect(
      alternatives(demoProject(true), "r50", { budget: 5_000_000, land: 24 })
        .filter((r) => r.nonDominated)
        .map((r) => r.id),
    ).toEqual(["none", "tank"]);
  });
  it("rejects incompatible target class and invalid persistence payload", () => {
    const p = demoProject(true);
    p.zones[0]!.surface = "soil";
    expect(evaluate(p, "r50", ["tank"], limits)).toBeNull();
    expect(
      snapshotSchema.safeParse({ ...initialSnapshot(), version: 2 }).success,
    ).toBe(false);
    expect(snapshotSchema.safeParse(initialSnapshot()).success).toBe(true);
  });
});
