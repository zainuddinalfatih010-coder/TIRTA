import { describe, expect, it } from "vitest";
import { chartMaximum, contiguousSegments, scenarioChartData } from "./ChartData";
import { demoProject } from "./productionBridge";
import { evaluatePlan, snapshotPlan } from "../domain/planningEngine";
import { productionBaseline } from "../domain/productionBaseline";

describe("scientific chart presentation", () => {
  it("reads engine results and baseline without changing canonical inputs", () => {
    const project = demoProject(true);
    const original = JSON.stringify(project);
    const plan = snapshotPlan(project, ["tank"], "chart-plan", "Tangki uji");
    const data = scenarioChartData(project, [{ id: plan.id, name: plan.name, plan }]);
    project.scenarios.forEach((scenario, i) => {
      const baseline = productionBaseline(project, scenario.id);
      const balance = evaluatePlan(project, plan, scenario.id);
      expect(data.baseline.values[i]).toBe(baseline.ok ? baseline.value.runoffM3 : null);
      expect(data.series[0]!.values[i]).toBe(balance.ok ? balance.value.residual : null);
    });
    expect(JSON.stringify(project)).toBe(original);
  });
  it("keeps missing scenario performance as a gap while known baseline remains visible", () => {
    const project = demoProject(true);
    const plan = snapshotPlan(project, ["tank"], "chart-plan", "Tangki uji");
    delete plan.components[0]!.performanceByScenario.r100;
    const data = scenarioChartData(project, [{ id: plan.id, name: plan.name, plan }]);
    expect(data.baseline.values[1]).not.toBeNull();
    expect(data.series[0]!.values[1]).toBeNull();
    expect(contiguousSegments([2, null, 0, 4, null, 1])).toEqual([
      [{ index: 0, value: 2 }], [{ index: 2, value: 0 }, { index: 3, value: 4 }], [{ index: 5, value: 1 }],
    ]);
  });
  it("preserves explicit zero rainfall and distinguishes UNKNOWN rainfall", () => {
    const project = demoProject(true);
    const rain = project.parameters.find(p => p.id === project.scenarios[0]!.rainfall.id)!;
    rain.value = 0;
    const plan = snapshotPlan(project, [], "none", "Tanpa intervensi");
    const known = scenarioChartData(project, [{ id: plan.id, name: plan.name, plan }]);
    expect(known.scenarios[0]!.depth).toBe(0);
    expect(known.baseline.values[0]).toBe(0);
    expect(known.series[0]!.values[0]).toBe(0);
    rain.value = null; rain.evidence = "UNKNOWN"; rain.source = "";
    project.scenarios[0]!.rainfall.evidence = "UNKNOWN";
    const unknown = scenarioChartData(project, [{ id: plan.id, name: plan.name, plan }]);
    expect(unknown.scenarios[0]!.depth).toBeNull();
    expect(unknown.baseline.values[0]).toBeNull();
    expect(unknown.series[0]!.values[0]).toBeNull();
  });
  it("uses a finite shared scale that never clips known values, including tiny and zero volumes", () => {
    for (const values of [[0, null], [0.00001, 0], [6.27, 12.54], [null, null]]) {
      const maximum = chartMaximum(values);
      expect(Number.isFinite(maximum)).toBe(true);
      expect(maximum).toBeGreaterThan(0);
      values.forEach(value => { if (value !== null) expect(maximum).toBeGreaterThanOrEqual(value); });
    }
  });
});
