import { describe, expect, it } from 'vitest';
import { demoProject, setActiveComponents } from '../direction/productionBridge';
import { fieldDecisionReadiness } from './fieldDecisionReadiness';
import { evaluateEventPlan, evaluatePlan, optimize, planningFingerprint, snapshotPlan } from './planningEngine';
import { readInput, saveComponent, saveRain } from './planningAuthoring';
import { savePlanningLimits } from './planningWorkspace';
import { clearInactiveDestinations, duplicateTreatment, overflowChoices } from './treatmentLifecycle';
import { deleteZone } from './authoring';
import { projectV2Schema, type ProjectV2 } from './projectV2';
import { unknownNumber } from './scientificContract';

const estimate = (value: string) => ({ text: value, evidence: 'ASSUMPTION' as const, source: 'Explicit synthetic regression assumption; not field evidence' });
const choose = (p: ProjectV2, ids: string[]) => ({ ...p, selectedPlan: { definition: snapshotPlan(p, ids, 'user-choice', 'Pilihan pengguna'), decisionNote: 'Pilihan pengguna', reviewedInputFingerprint: planningFingerprint(p) } });
const changedTank = (p: ProjectV2, id: string, capacity: string) => {
  const c = p.components.find(c => c.id === id)!;
  if (c.family !== 'storage') throw new Error('fixture');
  return saveComponent(p, { id, name: c.name, family: c.family, targets: c.targets, siteId: c.installationSiteId!, connection: c.connectionNote, applicability: c.applicability, cost: readInput(p, c.totalCost), area: readInput(p, c.occupiedArea), capacity: estimate(capacity), scenarioId: 'r50', reuse: null, treatment: c.treatment });
};

describe('explicit manual-only option space', () => {
  it('never invents a baseline option when no group and no manual option are declared', () => {
    const p = setActiveComponents(demoProject(), []);
    expect(optimize(p, 'r50').ok).toBe(false);
  });
  it('evaluates the baseline only after an explicit empty manual snapshot is declared', () => {
    const p = setActiveComponents(demoProject(), []);
    const baseline = snapshotPlan(p, [], 'explicit-baseline', 'Tanpa intervensi');
    baseline.optimizationScenarioId = 'r50';
    p.manualPlans.push(baseline);
    const before = JSON.stringify(p), result = optimize(p, 'r50');
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) {
      expect(result.value.declared).toBe(1); expect(result.value.evaluated).toBe(1);
      expect(result.value.alternatives.map(a => a.plan.id)).toEqual(['explicit-baseline']);
      expect(result.value.alternatives[0]!.balance.residual).toBeCloseTo(6.27);
      expect(result.value.alternatives[0]!.plan.components).toEqual([]);
    }
    expect(JSON.stringify(p)).toBe(before);
  });
  it('preserves unknown resource and minimum-intervention gates for a manually declared baseline', () => {
    const p = setActiveComponents(demoProject(), []);
    p.manualPlans.push(snapshotPlan(p, [], 'explicit-baseline', 'Tanpa intervensi'));
    p.constraints.minInstallations = 1;
    const excluded = optimize(p, 'r50');
    expect(excluded.ok).toBe(true);
    if (excluded.ok) { expect(excluded.value.alternatives).toEqual([]); expect(excluded.value.rejected).toBe(1); }
    const unknown = savePlanningLimits(p, { text: '', evidence: 'UNKNOWN', source: '' }, estimate('24'));
    expect(optimize(unknown, 'r50').ok).toBe(false);
    expect(evaluateEventPlan(unknown, unknown.manualPlans[0]!, 'r50').ok).toBe(true);
  });
});

describe('field mutations against scientific and readiness boundaries', () => {
  it('invalidates the chosen decision after budget/land edits without corrupting its frozen declaration', () => {
    const original = choose(setActiveComponents(demoProject(), ['tank', 'soak']), ['tank', 'soak']);
    const frozen = structuredClone(original.selectedPlan!.definition);
    const tightBudget = savePlanningLimits(original, estimate('1'), estimate('24'));
    expect(fieldDecisionReadiness(tightBudget, 'r50').selected.status).toBe('stale');
    expect(evaluatePlan(tightBudget, frozen, 'r50').ok).toBe(false);
    expect(evaluateEventPlan(tightBudget, frozen, 'r50').ok).toBe(true);
    const tightLand = savePlanningLimits(original, estimate('12000000'), estimate('1'));
    expect(fieldDecisionReadiness(tightLand, 'r50').selected.ready).toBe(false);
    expect(evaluatePlan(tightLand, frozen, 'r50').ok).toBe(false);
    expect(original.selectedPlan!.definition).toEqual(frozen);
  });
  it('retains a meaningful next action after capacity edit, duplicate, disable, rain edit and reload sequence', () => {
    let p: ProjectV2 = choose(setActiveComponents(demoProject(), ['tank', 'soak']), ['tank', 'soak']);
    const frozen = structuredClone(p.selectedPlan!.definition);
    expect(fieldDecisionReadiness(p, 'r50').selected.status).toBe('current');
    const copy = duplicateTreatment(p, 'tank', 'r50'); p = copy.project;
    const beforeTank = p.components.find(c => c.id === 'tank')!;
    if (beforeTank.family !== 'storage') throw new Error('fixture');
    const originalCapacity = readInput(p, beforeTank.performanceByScenario.r50!.availableStorage).text;
    p = changedTank(p, copy.id, '1');
    expect(fieldDecisionReadiness(p, 'r50').treatments.find(c => c.id === copy.id)!.calculationReady).toBe(true);
    expect(fieldDecisionReadiness(p,'r50').treatments.find(c=>c.id===copy.id)!.verificationReady).toBe(false);
    const original = p.components.find(c => c.id === 'tank')!;
    if (original.family !== 'storage') throw new Error('fixture');
    expect(readInput(p, original.performanceByScenario.r50!.availableStorage).text).toBe(originalCapacity);
    p = setActiveComponents(p, ['tank', 'soak']);
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(true);
    p = changedTank(p, 'tank', '1');
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(false);
    expect(fieldDecisionReadiness(p, 'r50').activePackage.actions.some(a => a.field === 'capacityBasis' && a.section === 'capacity')).toBe(true);
    p = saveRain(p, 'r50', p.scenarios[0]!.name, estimate('70'), 'Explicit changed test rainfall');
    expect(fieldDecisionReadiness(p, 'r50').selected.status).toBe('stale');
    const reloaded = projectV2Schema.parse(JSON.parse(JSON.stringify(p)));
    expect(fieldDecisionReadiness(reloaded, 'r50')).toEqual(fieldDecisionReadiness(p, 'r50'));
    expect(reloaded.selectedPlan!.definition).toEqual(frozen);
    expect(reloaded.scenarios[0]!.name).not.toContain('50 mm');
  });
  it('clears inactive destination references while leaving history and unrelated supported options intact', () => {
    const p = choose(setActiveComponents(demoProject(), ['tank', 'soak']), ['tank', 'soak']);
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
    p.components.find(c => c.id === 'soak')!.enabled = false;
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'before', 'Tangki'), 'r50').ok).toBe(false);
    const fixed = clearInactiveDestinations(p);
    expect(fixed.science!.interventions.tank!.overflow.kind).toBe('unknown');
    expect(overflowChoices(fixed, 'tank', 'r50').some(c => c.id === 'soak')).toBe(false);
    expect(fixed.selectedPlan).toEqual(p.selectedPlan);
    expect(evaluateEventPlan(fixed, snapshotPlan(fixed, ['tank'], 'after', 'Tangki'), 'r50').ok).toBe(true);
  });
  it('deleting a treatment source exposes area recovery and leaves the prior plan visibly unusable', () => {
    const p = choose(setActiveComponents(demoProject(), ['tank']), ['tank']);
    const changed = deleteZone(p, 'z0');
    const result = fieldDecisionReadiness(changed, 'r50');
    expect(result.baseline.ready).toBe(false);
    expect(result.baseline.actions.some(a => a.field === 'coverage')).toBe(true);
    expect(result.selected.ready).toBe(false);
    expect(evaluateEventPlan(changed, changed.selectedPlan!.definition, 'r50').ok).toBe(false);
    expect(changed.selectedPlan).toEqual(p.selectedPlan);
  });
  it('rejects jointly competing receiving footprints despite individually fitting options', () => {
    const p = setActiveComponents(demoProject(), ['tank', 'soak']);
    for (const c of p.components.filter(c => c.enabled)) {
      c.treatment = { installationZoneId: 'z4', sharedSourceMode: 'ledger', allocationNote: 'Explicit synthetic source ledger, not hydraulics', catchmentReviewed: true };
      p.parameters.find(x => x.id === c.occupiedArea.id)!.value = c.id === 'tank' ? 7 : 6;
    }
    const state = fieldDecisionReadiness(p, 'r50');
    expect(state.treatments.filter(c => c.status !== 'inactive' && c.status !== 'retired').every(c => c.comparisonReady)).toBe(true);
    expect(state.activePackage.comparisonReady).toBe(false);
    expect(state.activePackage.actions.some(a => a.field === 'area')).toBe(true);
    p.parameters.find(x => x.id === p.components.find(c => c.id === 'tank')!.occupiedArea.id)!.value = 6;
    expect(fieldDecisionReadiness(p, 'r50').activePackage.comparisonReady).toBe(true);
  });
  it('zero remains distinct from unknown, and unknown groundwater stays a verification condition', () => {
    const p = setActiveComponents(demoProject(), ['tank']), c = p.components.find(c => c.id === 'tank')!;
    if (c.family !== 'storage') throw new Error('fixture');
    p.science!.interventions.tank!.nominalTankCapacity = unknownNumber('m3');
    p.parameters.find(x => x.id === c.performanceByScenario.r50!.availableStorage.id)!.value = 0;
    const zero = evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'zero', 'Tangki nol'), 'r50');
    expect(zero.ok).toBe(true); if (zero.ok) expect(zero.value.stored).toBe(0);
    const ref = c.performanceByScenario.r50!.availableStorage;
    Object.assign(p.parameters.find(x => x.id === ref.id)!, { value: null, evidence: 'UNKNOWN' }); ref.evidence = 'UNKNOWN';
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(false);
    const soil = setActiveComponents(demoProject(), ['soak']);
    soil.science!.interventions.soak!.groundwaterAssessment = 'unknown';
    soil.science!.interventions.soak!.groundwaterBasis = '';
    expect(fieldDecisionReadiness(soil, 'r50').activePackage.calculationReady).toBe(true);
    expect(fieldDecisionReadiness(soil,'r50').activePackage.verificationChecks.some(f=>f.ruleId==='GROUNDWATER')).toBe(true);
  });
});
