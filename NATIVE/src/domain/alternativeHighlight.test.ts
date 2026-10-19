import { describe, expect, it } from "vitest";
import { demoProject, setActiveComponents } from "../direction/productionBridge";
import { optimize, type Alternative } from "./planningEngine";
import { runoffHighlights } from "./alternativeHighlight";

function candidates(): Alternative[] {
  const p = setActiveComponents(demoProject(true), ["tank", "soak", "garden", "porous"]);
  const result = optimize(p, p.scenarios[0]!.id);
  if (!result.ok) throw new Error("Fixture must have valid declared alternatives");
  return result.value.alternatives;
}

describe("transparent runoff recommendation highlight", () => {
  it("highlights lowest unrounded residual without changing Pareto, order, or input", () => {
    const rows = candidates(), before = structuredClone(rows);
    const min = Math.min(...rows.map(r => r.balance.residual));
    expect(runoffHighlights(rows)).toEqual(rows.filter(r => Math.abs(r.balance.residual - min) < 1e-9).map(r => r.plan.id));
    expect(rows).toEqual(before);
    expect(runoffHighlights(rows)).toEqual(runoffHighlights(rows));
  });

  it("preserves all ties, even when cost and area differ; does not rank by rounded labels", () => {
    const base = candidates()[0]!;
    const a = { ...base, plan: { ...base.plan, id: "a" }, balance: { ...base.balance, residual: 1.001, cost: 10, area: 1 } };
    const b = { ...base, plan: { ...base.plan, id: "b" }, balance: { ...base.balance, residual: 1.001, cost: 20, area: 2 } };
    const roundedTie = { ...b, plan: { ...base.plan, id: "c" }, balance: { ...b.balance, residual: 1.004 } };
    expect(runoffHighlights([a, b, roundedTie])).toEqual(["a", "b"]);
  });

  it("never endorses unknown, infeasible, zero-effect, or zero-rain results", () => {
    const a = candidates()[0]!;
    expect(runoffHighlights([])).toEqual([]);
    for (const change of [{ residual: NaN }, { cost: a.balance.budget + 1 }, { area: a.balance.usableArea + 1 }, { residual: a.balance.baseline }, { baseline: 0, residual: 0 }]) {
      expect(runoffHighlights([{ ...a, balance: { ...a.balance, ...change } }])).toEqual([]);
    }
  });
});
