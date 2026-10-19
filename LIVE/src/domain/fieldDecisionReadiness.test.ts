import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { fieldDecisionReadiness } from './fieldDecisionReadiness';
import { evaluatePlan, planningFingerprint, snapshotPlan } from './planningEngine';
import { emptySurfaceContext, unknownNumber } from './scientificContract';
import { duplicateTreatment } from './treatmentLifecycle';

const tankOnly = () => {
  const p = demoProject();
  p.components.forEach(c => { c.enabled = c.id === 'tank'; });
  p.optionGroups.forEach(g => { g.enabled = g.choices.some(c => c.componentIds.includes('tank')); });
  return p;
};

describe('actionable field decision readiness', () => {
  it('gives a concrete first action without inventing a project or water outcome', () => {
    const result = fieldDecisionReadiness(null, 'r50');
    expect(result.baseline.ready).toBe(false);
    expect(result.baseline.actions[0]).toMatchObject({ stage: 'project', field: 'projectName' });
    expect(result.selected.status).toBe('none');
  });
  it('separates water calculation from comparison when intervention cost is unknown', () => {
    const p = tankOnly(), c = p.components[0]!;
    c.totalCost.evidence = 'UNKNOWN';
    Object.assign(p.parameters.find(x => x.id === c.totalCost.id)!, { value: null, evidence: 'UNKNOWN', source: '' });
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.baseline.ready).toBe(true);
    expect(result.activePackage.calculationReady).toBe(true);
    expect(result.activePackage.comparisonReady).toBe(false);
    expect(result.treatments[0]!.comparisonActions[0]).toMatchObject({ componentId: c.id, field: 'cost', section: 'resources' });
    expect(result.activePackage).not.toHaveProperty('residual');
  });
  it('requires available storage, not optional nominal volume, and keeps known zero calculable', () => {
    const p = tankOnly(), c = p.components[0]!;
    if (c.family !== 'storage') throw new Error('fixture');
    const ref = c.performanceByScenario.r50!.availableStorage;
    const parameter = p.parameters.find(x => x.id === ref.id)!;
    p.science!.interventions.tank!.nominalTankCapacity = unknownNumber('m3');
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(true);
    parameter.value = 0;
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(true);
    Object.assign(parameter, { value: null, evidence: 'UNKNOWN', source: '' }); ref.evidence = 'UNKNOWN';
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.activePackage.calculationReady).toBe(false);
    expect(result.treatments[0]!.calculationActions.some(a => a.field === 'capacity' && a.componentId === c.id)).toBe(true);
  });
  it('turns unknown and unfavorable soil/groundwater into location actions without giving infiltration credit', () => {
    const p = demoProject();
    p.components.forEach(c => { c.enabled = c.id === 'soak'; });
    const e = p.science!.interventions.soak!;
    e.soilInfiltration = unknownNumber('mm/h');
    e.groundwaterAssessment = 'unsuitable';
    const state = fieldDecisionReadiness(p, 'r50').treatments.find(c => c.id === 'soak')!;
    expect(state.calculationReady).toBe(false);
    expect(state.calculationActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'GROUNDWATER', section: 'site', field: 'groundwater', severity: 'incompatible' }),
    ]));
    expect(state.verificationChecks.some(f=>f.ruleId==='SOIL')).toBe(true);
    expect(state.calculationActions.every(a => !!a.question && !!a.consequence && !!a.label)).toBe(true);
  });
  it('keeps inactive drafts separate while evaluating proposal-core permeable normally', () => {
    const p = tankOnly();
    p.components.find(c => c.id === 'soak')!.targets = [];
    p.components.find(c => c.family === 'permeable')!.enabled = true;
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.activePackage.calculationReady).toBe(true);
    expect(result.treatments.find(c => c.id === 'soak')!.status).toBe('inactive');
    expect(result.treatments.find(c => c.family === 'permeable')!.status).toBe('comparison-ready');
  });
  it('keeps an explicitly selected no-intervention plan independent of unfinished current options', () => {
    const p = demoProject();
    p.components[0]!.targets = [];
    p.selectedPlan = { definition: snapshotPlan(p, [], 'none', 'Tanpa intervensi'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.activePackage.calculationReady).toBe(false);
    expect(result.selected.status).toBe('current');
    expect(result.selected.calculationReady).toBe(true);
    expect(result.selected.comparisonReady).toBe(true);
    expect(result.selected.actions).toEqual([]);
  });
  it('keeps an old chosen plan as stale after new constraints without declaring a new choice', () => {
    const p = tankOnly();
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'chosen', 'Tangki'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    p.parameters.find(x => x.id === p.constraints.budget.id)!.value = 0;
    const before = JSON.stringify(p), result = fieldDecisionReadiness(p, 'r50');
    expect(result.selected.status).toBe('stale');
    expect(result.selected.ready).toBe(false);
    expect(result.selected.actions[0]).toMatchObject({ stage: 'alternatives', field: 'alternatives', section: 'selection' });
    expect(result.activePackage.comparisonReady).toBe(false);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('blocks a chosen plan that fails a required other rainfall scenario', () => {
    const p = tankOnly(), c = p.components[0]!;
    if (c.family !== 'storage') throw new Error('fixture');
    delete c.performanceByScenario.r100;
    p.constraints.requiredScenarioIds = ['r100'];
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'chosen', 'Tangki'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.selected.status).toBe('blocked');
    expect(result.selected.actions.some(a => a.scenarioId === 'r100')).toBe(true);
  });
  it('reports current source links to a disabled recipient as a connection action', () => {
    const p = tankOnly();
    const connection = p.science!.connections.find(x => x.destination.kind === 'intervention' && x.destination.id === 'tank')!;
    connection.destination = { kind: 'intervention', id: 'soak' };
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.activePackage.calculationReady).toBe(false);
    expect(result.treatments[0]!.calculationActions.some(a => a.section === 'connection')).toBe(true);
  });
  it('reports missing rainfall as a Hujan action while accepting zero rainfall', () => {
    const p = tankOnly(), ref = p.scenarios[0]!.rainfall;
    const parameter = p.parameters.find(x => x.id === ref.id)!;
    parameter.value = 0;
    expect(fieldDecisionReadiness(p, 'r50').baseline.ready).toBe(true);
    Object.assign(parameter, { value: null, evidence: 'UNKNOWN', source: '' }); ref.evidence = 'UNKNOWN';
    expect(fieldDecisionReadiness(p, 'r50').baseline.actions[0]).toMatchObject({ stage: 'rain', field: 'rainfall' });
  });
  it('routes unknown rainfall in another required scenario directly to that scenario', () => {
    const p = tankOnly(), ref = p.scenarios.find(s => s.id === 'r100')!.rainfall;
    Object.assign(p.parameters.find(x => x.id === ref.id)!, { value: null, evidence: 'UNKNOWN', source: '' }); ref.evidence = 'UNKNOWN';
    p.constraints.requiredScenarioIds = ['r100'];
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'chosen', 'Tangki'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    const result = fieldDecisionReadiness(p, 'r50');
    expect(result.baseline.ready).toBe(true);
    expect(result.treatments[0]!.calculationReady).toBe(true);
    expect(result.selected.status).toBe('blocked');
    expect(result.selected.actions[0]).toMatchObject({ stage: 'rain', field: 'rainfall', scenarioId: 'r100' });
  });
  it('finds aggregate budget failure even when every individual treatment fits the budget', () => {
    const p = demoProject();
    p.components.forEach(c => { c.enabled = ['tank', 'garden'].includes(c.id); });
    p.parameters.find(x => x.id === p.constraints.budget.id)!.value = 5_000_000;
    const state = fieldDecisionReadiness(p, 'r50');
    expect(state.treatments.filter(c => c.status !== 'inactive' && c.status !== 'retired').every(c => c.comparisonReady)).toBe(true);
    expect(state.activePackage.calculationReady).toBe(true);
    expect(state.activePackage.comparisonReady).toBe(false);
    expect(state.activePackage.comparisonActions[0]).toMatchObject({ section: 'constraints', field: 'budget' });
  });
  it('rejects a current recipient that exists only in frozen history', () => {
    const p = tankOnly();
    p.components.find(c => c.id === 'soak')!.enabled = true;
    p.manualPlans.push(snapshotPlan(p, ['soak'], 'old-soak', 'Riwayat resapan'));
    p.components = p.components.filter(c => c.id !== 'soak');
    p.optionGroups = p.optionGroups.filter(g => !g.choices.some(choice => choice.componentIds.includes('soak')));
    p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
    const state = fieldDecisionReadiness(p, 'r50');
    expect(state.baseline.ready).toBe(true);
    expect(state.activePackage.calculationReady).toBe(false);
    expect(state.activePackage.calculationActions.some(a => a.ruleId === 'CONNECTION' && a.componentId === 'tank')).toBe(true);
    expect(state.treatments.some(c => c.id === 'soak')).toBe(false);
  });
  it('marks reused soil support for verification after observation changes without erasing declared capacity', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    p.components.forEach(other => { other.enabled = other.id === c.id; });
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Declared ledger', catchmentReviewed: true };
    const context = emptySurfaceContext(); context.soil.infiltration = { value: 8, unit: 'mm/h', origin: 'user_supplied', source: 'Synthetic explicit soil evidence', method: '', date: '' };
    p.science!.surfaces.z2 = context;
    p.science!.interventions.soak!.soilReference = { zoneId: 'z2', confirmation: 'Explicit same-site confirmation', observation: structuredClone(context.soil.infiltration) };
    expect(fieldDecisionReadiness(p, 'r50').activePackage.calculationReady).toBe(true);
    context.soil.infiltration.value = 4;
    const state = fieldDecisionReadiness(p, 'r50');
    expect(state.activePackage.calculationReady).toBe(true);
    expect(state.activePackage.verificationReady).toBe(false);
    expect(state.activePackage.verificationChecks.some(a=>a.ruleId==='SOIL')).toBe(true);
  });
  it('an explicit duplicate remains a new unsupported idea, without contaminating the original treatment', () => {
    const p = tankOnly(), { project: copied, id } = duplicateTreatment(p, 'tank', 'r50');
    const state = fieldDecisionReadiness(copied, 'r50');
    expect(state.treatments.find(c => c.id === 'tank')!.calculationReady).toBe(true);
    expect(state.treatments.find(c => c.id === id)!.calculationReady).toBe(false);
    expect(state.treatments.find(c => c.id === id)!.calculationActions.some(a => a.field === 'capacity')).toBe(true);
  });
});


describe('structured issue destinations',()=>{
  it('whole-catchment metadata is not a second source authority, regardless of component name',()=>{
    const p=tankOnly(),c=p.components.find(c=>c.id==='tank')!;
    c.treatment={installationZoneId:null,sharedSourceMode:'ledger',allocationNote:'Explicit',catchmentReviewed:null};
    const first=fieldDecisionReadiness(p,'r50').activePackage.actions.find(a=>a.field==='catchmentReviewed');
    expect(first).toBeUndefined();expect(fieldDecisionReadiness(p,'r50').activePackage.calculationReady).toBe(true);
    c.name='Anggaran kapasitas tanah — label bebas';
    expect(fieldDecisionReadiness(p,'r50').activePackage.actions.find(a=>a.field==='catchmentReviewed')).toBeUndefined();
  });
  it('minimum-installation failure routes to the minimum constraint instead of area or cost',()=>{
    const p=tankOnly();p.components.forEach(c=>{c.enabled=false;});p.constraints.minInstallations=1;
    const issue=fieldDecisionReadiness(p,'r50').activePackage.comparisonActions[0];
    expect(issue).toMatchObject({field:'minInstallations',section:'constraints',scenarioId:'r50'});
    expect(evaluatePlan(p,snapshotPlan(p,[],'none','Label bebas'),'r50')).toMatchObject({ok:false,issues:[{field:'minInstallations'}]});
  });
  it('Biopori installation is the first action before source and missing capacity, never an inherited zone',()=>{
    const p=tankOnly(),c=p.components.find(c=>c.id==='soak')!;p.components.forEach(x=>{x.enabled=x.id===c.id;});
    if(c.family!=='infiltration')throw new Error('fixture');c.infiltrationType='biopori';c.targets=[];c.treatment={installationZoneId:null,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:null};
    expect(fieldDecisionReadiness(p,'r50').activePackage.actions[0]).toMatchObject({componentId:c.id,field:'installation',section:'connection',ruleId:'BIOPORI_SITE'});
  });
});
