import type { Alternative } from "./planningEngine";

// Presentation only: callers supply the current feasible Pareto set.
// No score, weights, reordering, tie breaker, or automatic plan selection.
export function runoffHighlights(alternatives: readonly Alternative[]): string[] {
  const valid = alternatives.filter(({ balance: b }) =>
    [b.baseline, b.residual, b.cost, b.area, b.budget, b.usableArea].every(Number.isFinite)
    && b.baseline > 0 && b.residual >= 0 && b.residual <= b.baseline
    && b.cost >= 0 && b.area >= 0 && b.cost <= b.budget && b.area <= b.usableArea);
  if (!valid.length) return [];
  const residual = Math.min(...valid.map(a => a.balance.residual));
  return valid.filter(({ balance: b }) => {
    const tolerance = 1e-9 * Math.max(1, b.baseline);
    return b.baseline - b.residual > tolerance && Math.abs(b.residual - residual) <= tolerance;
  }).map(a => a.plan.id);
}
