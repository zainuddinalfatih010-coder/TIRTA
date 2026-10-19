import { describe, expect, it } from 'vitest';
import { demoProject, setActiveComponents } from '../direction/productionBridge';
import { routingIssues, sourceConnects } from './sourceRouting';
import { assessIntervention } from './feasibility';
import { evaluateEventPlan, snapshotPlan } from './planningEngine';
import { projectV2Schema } from './projectV2';
import { deleteZone } from './authoring';
import { readInput, saveComponent, saveRain } from './planningAuthoring';
import { emptySurfaceContext, unknownNumber } from './scientificContract';
import { duplicateTreatment, overflowChoices } from './treatmentLifecycle';
import { siteGuidance } from './siteGuidance';
import { parcelPackageTemplates } from './packageRecommendations';

describe('rescue independent adversarial field and lifecycle review', () => {
  it('retains an imported inactive overflow for repair while refusing current credited planning', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'tank')!;
    p.components.find(c => c.id === 'soak')!.enabled = false;
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
    expect(projectV2Schema.safeParse(p).success).toBe(true);
    expect(routingIssues(p, { componentIds: ['tank'] }).join(' ')).toContain('tidak aktif');
    expect(assessIntervention(p, c, 'r50', p.parameters, undefined, false, [c]).reasons.map(x => x.message).join(' ')).toContain('tidak aktif');
    expect(overflowChoices(p, 'tank', 'r50').some(c => c.id === 'soak')).toBe(false);
  });

  it('frozen history is not an actionable current destination, but explicit historical inspection keeps identities', () => {
    const p = demoProject();
    p.manualPlans.push(snapshotPlan(p, ['soak'], 'old-soak', 'Historical soak'));
    p.components = p.components.filter(c => c.id !== 'soak');
    p.optionGroups = p.optionGroups.filter(group => !group.choices.some(choice => choice.componentIds.includes('soak')));
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
    const before = structuredClone(p.manualPlans);
    expect(routingIssues(p, { componentIds: ['tank'] }).join(' ')).toContain('tidak aktif');
    expect(routingIssues(p, { componentIds: ['tank'], allowHistoricalDestinations: true })).toEqual([]);
    expect(p.manualPlans).toEqual(before);
  });

  it('conversion is a current option but is not treated as a discrete overflow recipient', () => {
    const p = demoProject();
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'porous' };
    expect(routingIssues(p, { componentIds: ['tank'] }).join(' ')).toContain('tidak aktif');
    expect(overflowChoices(p, 'tank', 'r50').some(c => c.family === 'permeable')).toBe(false);
    expect(siteGuidance(p, 'r50').find(g => g.id === 'permeable')!.status).toBe('eligible');
  });

  it('an unrelated draft missing site evidence does not poison a fully connected tank-only ledger', () => {
    const p = demoProject(), tank = p.components.find(c => c.id === 'tank')!;
    p.components.find(c => c.id === 'soak')!.enabled = false;
    p.science!.interventions.garden!.overflow = { kind: 'intervention', id: 'soak' };
    expect(routingIssues(p, { componentIds: ['tank'] })).toEqual([]);
    expect(sourceConnects(p, 'z0', 'tank')).toBe(true);
    const result = evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'only-tank', 'Tank'), 'r50');
    expect(result.ok).toBe(true);
    expect(assessIntervention(p, tank, 'r50', p.parameters, undefined, false, [tank]).reasons).toEqual([]);
  });

  it('cycles in the selected recipient chain are rejected even if the second recipient is not credited in that plan', () => {
    const p = demoProject();
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
    p.science!.interventions.soak!.overflow = { kind: 'intervention', id: 'tank' };
    expect(routingIssues(p, { componentIds: ['tank'] }).join(' ')).toContain('siklus');
  });

  it('unknown available storage blocks; real zero gives zero capture despite known nominal volume', () => {
    const p = setActiveComponents(demoProject(), ['tank']);
    const c = p.components.find(c => c.id === 'tank')!; if (c.family !== 'storage') throw new Error('fixture');
    const ref = c.performanceByScenario.r50!.availableStorage;
    const value = p.parameters.find(x => x.id === ref.id)!;
    value.value = null; value.evidence = 'UNKNOWN'; ref.evidence = 'UNKNOWN';
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'unknown', 'Unknown'), 'r50').ok).toBe(false);
    value.value = 0; value.evidence = 'DEMO'; ref.evidence = 'DEMO';
    p.science!.interventions.tank!.nominalTankCapacity = unknownNumber('m3');
    const result = evaluateEventPlan(p, snapshotPlan(p, ['tank'], 'zero', 'Zero'), 'r50');
    expect(result.ok).toBe(true); if (result.ok) { expect(result.value.stored).toBe(0); expect(result.value.residual).toBe(result.value.baseline); }
  });

  it('shared roof sources debit only remaining volume, and unsupported parallel allocation is rejected', () => {
    const p = setActiveComponents(demoProject(), ['tank', 'soak']);
    const tank = p.components.find(c => c.id === 'tank')!, soak = p.components.find(c => c.id === 'soak')!;
    for (const c of [tank, soak]) {
      c.targets = ['z0'];
      c.treatment = { installationZoneId: c.id === 'soak' ? 'z2' : null, sharedSourceMode: 'ledger', allocationNote: 'Synthetic explicit remaining-volume sequence', catchmentReviewed: true };
    }
    p.science!.connections = p.science!.connections.filter(link => link.candidateId !== 'soak');
    p.science!.connections.push({ id: 'synthetic-shared-roof-soak', candidateId: 'soak', sourceZoneId: 'z0', destination: { kind: 'intervention', id: 'soak' }, via: 'other', origin: 'user_supplied', source: 'Explicit synthetic second connection, not surveyed' });
    const result = evaluateEventPlan(p, snapshotPlan(p, ['tank', 'soak'], 'shared', 'Shared source'), 'r50');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stored).toBeCloseTo(2.55, 10);
      expect(result.value.infiltrated).toBe(0);
      expect(result.value.residual + result.value.stored + result.value.infiltrated).toBeCloseTo(result.value.baseline, 10);
    }
    soak.treatment!.sharedSourceMode = 'parallel';
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank', 'soak'], 'parallel', 'Parallel'), 'r50').ok).toBe(false);
  });

  it('changed rain and duration withdraw infiltration support while keeping same-depth baseline semantics', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    const deeper = saveRain(p, 'r50', 'Changed test', { text: '75', source: 'Adversarial synthetic scenario', evidence: 'ASSUMPTION' }, '');
    expect(assessIntervention(deeper, c, 'r50', deeper.parameters, undefined, false, [c]).missing.some(x => /Konteks hujan/.test(x.message))).toBe(true);
    p.science!.rainfall.r50 = { value: 60, unit: 'minutes', origin: 'user_supplied', source: 'Synthetic duration', method: '', date: '' };
    expect(assessIntervention(p, c, 'r50', p.parameters, undefined, false, [c]).missing.some(x => /Konteks hujan/.test(x.message))).toBe(true);
    p.science!.interventions.soak!.groundwaterAssessment = 'unsuitable';
    expect(assessIntervention(p, c, 'r50', p.parameters, undefined, false, [c]).reasons.some(x => x.ruleId === 'GROUNDWATER')).toBe(true);
  });

  it('changed referenced soil requires verification; duplicate does not inherit physical performance or routes', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic ledger', catchmentReviewed: true };
    const soil = emptySurfaceContext(); soil.soil.infiltration = { value: 8, unit: 'mm/h', origin: 'user_supplied', source: 'Synthetic soil evidence', method: '', date: '' };
    p.science!.surfaces.z2 = soil;
    p.science!.interventions.soak!.soilReference = { zoneId: 'z2', confirmation: 'Synthetic same site', observation: structuredClone(soil.soil.infiltration) };
    soil.soil.infiltration.value = 9;
    expect(assessIntervention(p, c, 'r50', p.parameters, undefined, false, [c]).conditions.some(x => x.ruleId === 'SOIL')).toBe(true);
    const copy = duplicateTreatment(p, c.id, 'r50');
    expect(copy.project.science!.interventions[copy.id]!.performance).toEqual({});
    expect(copy.project.science!.connections.some(route => route.candidateId === copy.id)).toBe(false);
  });

  it('deleting a receiving zone preserves the frozen plan and withdraws its current location reference', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic ledger', catchmentReviewed: true };
    const old = snapshotPlan(p, ['soak'], 'historic', 'Historical site'); p.manualPlans.push(old);
    const next = deleteZone(p, 'z2');
    expect(next.manualPlans[0]).toEqual(old);
    expect(next.components.find(c => c.id === 'soak')!.treatment!.installationZoneId).toBeNull();
    expect(evaluateEventPlan(next, snapshotPlan(next, ['soak'], 'new', 'New'), 'r50').ok).toBe(false);
  });

  it('moving a previously supported resapan draft does not retain unreviewed old-site soil/groundwater support', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!; if (c.family !== 'infiltration') throw new Error('fixture');
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic ledger', catchmentReviewed: true };
    const perf = c.performanceByScenario.r50!;
    const moved = saveComponent(p, { id: c.id, name: c.name, family: c.family, targets: c.targets, siteId: c.installationSiteId!,
      connection: c.connectionNote, applicability: c.applicability, cost: readInput(p, c.totalCost), area: readInput(p, c.occupiedArea),
      capacity: readInput(p, perf.infiltrationCapacity), scenarioId: 'r50', reuse: null,
      treatment: { ...c.treatment, installationZoneId: 'z3' },
    });
    const review = assessIntervention(moved, moved.components.find(c => c.id === 'soak')!, 'r50', moved.parameters, undefined, false);
    expect(review.conditions.some(x=>x.ruleId==='SOIL'||x.ruleId==='GROUNDWATER')).toBe(true);
    expect(review.missing).toEqual([]);
  });

  it('storage relocation retains available event capacity and frozen old site records stay unchanged', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'tank')!; if (c.family !== 'storage') throw new Error('fixture');
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic ledger', catchmentReviewed: true };
    const plan = snapshotPlan(p, ['tank'], 'old-storage-site', 'Old tank'); p.manualPlans.push(plan);
    const evidence = structuredClone(p.science!.interventions.tank!);
    const moved = saveComponent(p, { id: c.id, name: c.name, family: c.family, targets: c.targets, siteId: c.installationSiteId!,
      connection: c.connectionNote, applicability: c.applicability, cost: readInput(p, c.totalCost), area: readInput(p, c.occupiedArea),
      capacity: readInput(p, c.performanceByScenario.r50!.availableStorage), scenarioId: 'r50', reuse: null,
      treatment: { ...c.treatment, installationZoneId: 'z3' },
    });
    expect(moved.science!.interventions.tank).toEqual(evidence);
    expect(moved.manualPlans[0]).toEqual(plan);
    expect(moved.parameters).toEqual(p.parameters);
    expect(evaluateEventPlan(moved, snapshotPlan(moved, ['tank'], 'new-storage-site', 'New tank'), 'r50').ok).toBe(true);
  });

  it('generic package templates keep Biopori educational-only regardless of soil evidence', () => {
    const p = demoProject(); p.science!.surfaces.z2 = emptySurfaceContext();
    p.science!.surfaces.z2.soil.infiltration = { value: 0, unit: 'mm/h', origin: 'user_supplied', source: 'Synthetic zero evidence', method: '', date: '' };
    const templates = parcelPackageTemplates(p, 'r50');
    expect(templates.some(t => t.options.some(o => o.biopori))).toBe(false);
    expect(templates.some(t => t.options.some(o => o.family === 'storage'))).toBe(true);
    p.science!.surfaces.z2.soil.infiltration = unknownNumber('mm/h');
    expect(parcelPackageTemplates(p, 'r50').some(t => t.options.some(o => o.biopori))).toBe(false);
  });

  it('known unsuitable groundwater at the only soil receiver withdraws Biopori templates without retiring tanks', () => {
    const p = demoProject(); p.science!.surfaces.z2 = emptySurfaceContext();
    p.science!.surfaces.z2.soil.infiltration = { value: 8, unit: 'mm/h', origin: 'user_supplied', source: 'Synthetic soil evidence', method: '', date: '' };
    p.components.find(c => c.id === 'soak')!.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic', catchmentReviewed: true };
    p.science!.interventions.soak!.groundwaterAssessment = 'unsuitable';
    const templates = parcelPackageTemplates(p, 'r50');
    expect(templates.some(t => t.options.some(o => o.biopori))).toBe(false);
    expect(templates.some(t => t.options.some(o => o.family === 'storage'))).toBe(true);
    p.science!.surfaces.z2.soil.infiltration = unknownNumber('mm/h');
    expect(parcelPackageTemplates(p, 'r50').some(t => t.options.some(o => o.biopori))).toBe(false);
  });
});
