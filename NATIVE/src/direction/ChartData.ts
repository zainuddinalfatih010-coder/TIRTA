import type { ProjectV2 } from "../domain/projectV2";
import { evaluatePlan, type Plan } from "../domain/planningEngine";
import { evaluate } from "./productionBridge";

export type ChartValue = number | null;
export interface ScenarioSeries { id: string; name: string; values: ChartValue[] }
export interface ScenarioLabel { id: string; name: string; depth: ChartValue }

// Presentation adapter. Missing/invalid evaluations remain gaps, never zero.
export function scenarioChartData(project: ProjectV2, plans: readonly { id: string; name: string; plan: Plan }[]) {
  const scenarios: ScenarioLabel[] = project.scenarios.map(s => ({
    id: s.id, name: s.name, depth: evaluate(project, s.id, [])?.baseline.rainfallMm ?? null,
  }));
  const baseline: ScenarioSeries = { id: "baseline", name: "Tanpa intervensi", values: project.scenarios.map(s => evaluate(project, s.id, [])?.baseline.runoffM3 ?? null) };
  return { scenarios, baseline, series: plans.map(p => ({ id: p.id, name: p.name, values: project.scenarios.map(s => {
    const outcome = evaluatePlan(project, p.plan, s.id);
    return outcome.ok ? outcome.value.residual : null;
  }) })) };
}

export function chartMaximum(values: readonly ChartValue[]) {
  const maximum = Math.max(0, ...values.filter((n): n is number => n !== null && Number.isFinite(n)));
  if (maximum === 0) return 1;
  const step = 10 ** Math.floor(Math.log10(maximum)) / 2;
  return Math.ceil(maximum / step) * step;
}

export function contiguousSegments(values: readonly ChartValue[]) {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) { if (current.length) segments.push(current); current = []; }
    else current.push({ index, value });
  });
  if (current.length) segments.push(current);
  return segments;
}
