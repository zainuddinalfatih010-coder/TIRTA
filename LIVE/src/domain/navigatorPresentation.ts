import type { NavigatorFact } from './navigatorFacts';
import { factIsAvailable } from './navigatorPlanner';

/** Presentation follows the planner's readiness; optional unknowns are not debts. */
export function navigatorReadinessSummary(facts: NavigatorFact[]) {
  const pending = facts.filter(f => !factIsAvailable(f));
  const actionable = pending.filter(f => !f.optional || f.status === 'invalid' || f.status === 'stale');
  // Drainage is the aggregate of the same roof facts, not one more input.
  const remaining = actionable.filter(f => f.key !== 'roofDrainage' || !actionable.some(other => other.objectId === f.objectId && other.scenarioId === f.scenarioId && other.key.startsWith('roof') && other.key !== 'roofDrainage'));
  const optional = pending.filter(f => f.optional && f.status !== 'invalid' && f.status !== 'stale');
  const stale = remaining.some(f => f.status === 'stale');
  return { remaining: remaining.length, optional: optional.length, stale,
    label: stale ? 'Perlu ditinjau ulang' : remaining.length ? `${remaining.length} hal perlu dilengkapi` : optional.length ? 'Data utama sudah cukup' : facts.length ? 'Siap dilanjutkan' : 'Belum ada',
    detail: optional.length ? `${optional.length} detail tambahan belum diketahui` : '' };
}
