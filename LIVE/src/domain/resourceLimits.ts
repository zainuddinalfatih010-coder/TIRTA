export type ResourceValues = { cost: number; area: number };
export type ResourceLimits = { budget: number | null; land: number | null };

export function resourceLimitStatus(values: ResourceValues, limits: ResourceLimits) {
  const budgetExceededBy = limits.budget !== null && values.cost > limits.budget ? values.cost - limits.budget : null;
  const landExceededBy = limits.land !== null && values.area > limits.land ? values.area - limits.land : null;
  return {
    budgetExceededBy,
    landExceededBy,
    withinKnownLimits: budgetExceededBy === null && landExceededBy === null,
  };
}
