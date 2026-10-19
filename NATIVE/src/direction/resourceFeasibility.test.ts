import { describe, expect, it } from 'vitest';
import { resourceLimitStatus } from '../domain/resourceLimits';

describe('resource limit status', () => {
  it('separates known over-budget/over-land constraints from the water calculation itself', () => {
    const status = resourceLimitStatus({ cost: 8_500_000, area: 12 }, { budget: 8_000_000, land: 10 });
    expect(status.withinKnownLimits).toBe(false);
    expect(status.budgetExceededBy).toBe(500_000);
    expect(status.landExceededBy).toBe(2);
  });

  it('does not invent a failure when a limit is still unknown', () => {
    const status = resourceLimitStatus({ cost: 8_500_000, area: 12 }, { budget: null, land: null });
    expect(status.withinKnownLimits).toBe(true);
    expect(status.budgetExceededBy).toBeNull();
    expect(status.landExceededBy).toBeNull();
  });
});
