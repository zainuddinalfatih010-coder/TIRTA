import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { assessIntervention } from './feasibility';
import { evaluateEventPlan, evaluatePlan, snapshotPlan } from './planningEngine';
import { unknownNumber } from './scientificContract';

describe('field-ready screening and receiving space', () => {
  it('evaluates known available storage without requiring nominal tank size', () => {
    const p = demoProject();
    p.science!.interventions.tank!.nominalTankCapacity = unknownNumber('m3');
    expect(assessIntervention(p, p.components[0]!, 'r50').missing.some(x => x.ruleId === 'CAPACITY')).toBe(false);
    const result = evaluatePlan(p, snapshotPlan(p, ['tank'], 'p', 'Tank'), 'r50');
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.value.stored).toBeCloseTo(2.55);
  });
  it('still rejects available storage above known nominal volume and never substitutes nominal for missing available storage', () => {
    const p = demoProject(), c = p.components[0]!;
    p.science!.interventions.tank!.nominalTankCapacity.value = 1;
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'p', 'Tank'), 'r50').ok).toBe(false);
    p.science!.interventions.tank!.nominalTankCapacity.value = 10;
    if (c.family !== 'storage') throw new Error('fixture');
    const parameter = p.parameters.find(x => x.id === c.performanceByScenario.r50!.availableStorage.id)!;
    parameter.value = null; parameter.evidence = 'UNKNOWN';
    c.performanceByScenario.r50!.availableStorage.evidence = 'UNKNOWN';
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'p', 'Tank'), 'r50').ok).toBe(false);
  });
  it('keeps optional standard/media questions as conditions when supported event performance and soil/groundwater are known', () => {
    const p = demoProject(), c = p.components.find(x => x.id === 'garden')!;
    const e = p.science!.interventions.garden!;
    e.localStandardReview = 'unknown'; e.localStandardBasis = ''; e.media = ''; e.vegetation = '';
    const f = assessIntervention(p, c, 'r50');
    expect(f.missing.filter(x => x.ruleId === 'STANDARD' || x.ruleId === 'MEDIA')).toEqual([]);
    expect(f.conditions.map(x => x.ruleId)).toEqual(expect.arrayContaining(['STANDARD', 'MEDIA']));
    expect(evaluatePlan(p, snapshotPlan(p, ['garden'], 'p', 'Garden'), 'r50').ok).toBe(true);
    e.localStandardReview = 'failed'; e.localStandardBasis = 'Explicit failed local review';
    expect(evaluateEventPlan(p, snapshotPlan(p, ['garden'], 'p', 'Garden'), 'r50').ok).toBe(false);
  });
  it('uses declared event capacity with unknown site evidence while retaining adverse groundwater rejection', () => {
    const p = demoProject(), e = p.science!.interventions.soak!;
    e.localStandardReview = 'unknown'; e.localStandardBasis = '';
    e.soilInfiltration = unknownNumber('mm/h');
    expect(evaluateEventPlan(p, snapshotPlan(p, ['soak'], 'p', 'Soak'), 'r50').ok).toBe(true);
    expect(assessIntervention(p,p.components.find(x=>x.id==='soak')!,'r50').conditions.some(x=>x.ruleId==='SOIL')).toBe(true);
    e.groundwaterAssessment = 'unsuitable';
    expect(assessIntervention(p, p.components.find(x => x.id === 'soak')!, 'r50').reasons.some(x => x.ruleId === 'GROUNDWATER')).toBe(true);
  });
  it('bounds an intervention by its receiving zone rather than its source or global site', () => {
    const p = demoProject(), c = p.components[0]!;
    c.treatment = { installationZoneId: 'z4', sharedSourceMode: 'ledger', allocationNote: 'Declared remaining ledger', catchmentReviewed: true };
    p.parameters.find(x => x.id === c.occupiedArea.id)!.value = 13;
    const result = evaluatePlan(p, snapshotPlan(p, ['tank'], 'p', 'Tank'), 'r50');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map(x => x.message).join()).toContain('Paving berpori');
    p.parameters.find(x => x.id === c.occupiedArea.id)!.value = 12;
    expect(evaluatePlan(p, snapshotPlan(p, ['tank'], 'p', 'Tank'), 'r50').ok).toBe(true);
  });
  it('sums all selected footprints at the same receiving zone and permits exact equality', () => {
    const p = demoProject();
    for (const id of ['tank', 'garden']) {
      const c = p.components.find(x => x.id === id)!;
      c.treatment = { installationZoneId: 'z4', sharedSourceMode: 'ledger', allocationNote: 'Declared remaining ledger', catchmentReviewed: true };
      p.parameters.find(x => x.id === c.occupiedArea.id)!.value = id === 'tank' ? 7 : 6;
    }
    expect(evaluatePlan(p, snapshotPlan(p, ['tank', 'garden'], 'p', 'Combined'), 'r50').ok).toBe(false);
    p.parameters.find(x => x.id === p.components[0]!.occupiedArea.id)!.value = 6;
    expect(evaluatePlan(p, snapshotPlan(p, ['tank', 'garden'], 'p', 'Combined'), 'r50').ok).toBe(true);
    expect(evaluatePlan(p, snapshotPlan(p, ['tank'], 'p', 'Only tank'), 'r50').ok).toBe(true);
  });
});
