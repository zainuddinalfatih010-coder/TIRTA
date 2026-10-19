import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { addTreatment, porousConsistency, referencedSoil, treatmentRoles, treatmentPlacementIssue } from './treatmentDesign';
import { emptyInterventionEvidence, emptySurfaceContext } from './scientificContract';
import { evaluateEventPlan, evaluatePlan, snapshotPlan, optimize } from './planningEngine';
import { emptyInput, readInput, saveRain, saveComponent } from './planningAuthoring';
import { savePlanningLimits } from './planningWorkspace';
import { assessIntervention } from './feasibility';
import { addShape, updateShapeData, deleteZone } from './authoring';
import { createProjectV2, projectV2Schema } from './projectV2';
import { scientificScenarioContext, updateScience } from './scientificAuthoring';
import { interventionEvidenceSchema } from './scientificContract';
import { blankFieldEvaluation, fieldNextActions } from './fieldEvaluation';

describe('role-separated treatment design', () => {
  it('keeps one large roof as one source and adds separate instances with UNKNOWN inputs', () => {
    let p = demoProject();
    const first = addTreatment(p, 'storage', p.scenarios[0]!.id, 'z0');
    p = first.project;
    const second = addTreatment(p, 'storage', p.scenarios[0]!.id, 'z0');
    expect(second.id).not.toBe(first.id);
    const c = second.project.components.find(c => c.id === second.id)!;
    expect(treatmentRoles(c).sourceZoneIds).toEqual(['z0']);
    expect(readInput(second.project, c.totalCost).text).toBe('');
    expect(readInput(second.project, c.occupiedArea).text).toBe('');
    expect(assessIntervention(second.project, c, p.scenarios[0]!.id).missing.some(x => x.message.includes('Sumber dipakai'))).toBe(true);
  });
  it('does not confuse existing porous surface with conversion', () => {
    const p = demoProject();
    const added = addTreatment(p, 'permeable', p.scenarios[0]!.id, 'z4');
    expect(added.project.components.find(c => c.id === added.id)!.targets).toEqual([]);
    const valid = addTreatment(p, 'permeable', p.scenarios[0]!.id, 'z1');
    expect(treatmentRoles(valid.project.components.find(c => c.id === valid.id)!).conversionZoneId).toBe('z1');
  });
  it('uses exactly the same water ledger before and after entering budget', () => {
    const p = demoProject(), sid = p.scenarios[0]!.id;
    const plan = snapshotPlan(p, ['tank'], 'test', 'Tangki');
    const full = evaluatePlan(p, plan, sid), event = evaluateEventPlan(p, plan, sid);
    expect(full.ok).toBe(true); expect(event.ok).toBe(true);
    if (full.ok && event.ok) {
      expect(event.value.residual).toBe(full.value.residual);
      expect(event.value.stored).toBe(full.value.stored);
      expect(event.value).not.toHaveProperty('cost');
    }
    const noMoney = savePlanningLimits(p, emptyInput(), emptyInput());
    expect(evaluatePlan(noMoney, snapshotPlan(noMoney, ['tank'], 'test', 'Tangki'), sid).ok).toBe(false);
    const water = evaluateEventPlan(noMoney, snapshotPlan(noMoney, ['tank'], 'test', 'Tangki'), sid);
    expect(water.ok).toBe(true);
    if (event.ok && water.ok) expect(water.value).toEqual(event.value);
  });
  it('blocks unmeasured parallel split and does not produce false benefit for UNKNOWN capacity', () => {
    const p = demoProject(), sid = p.scenarios[0]!.id;
    const c = p.components.find(c => c.id === 'tank')!;
    const other = p.components.find(c => c.id === 'garden')!; other.targets = [...c.targets];
    c.treatment = { installationZoneId: null, sharedSourceMode: 'parallel', allocationNote: '' };
    expect(evaluateEventPlan(p, snapshotPlan(p, ['tank', 'garden'], 'p', 'p'), sid).ok).toBe(false);
    const a = addTreatment(p, 'storage', sid, 'z0');
    expect(evaluateEventPlan(a.project, snapshotPlan(a.project, [a.id], 'p', 'p'), sid).ok).toBe(false);
  });
  it('references soil only after confirmation, and detects changed evidence or a different installation zone', () => {
    const p = demoProject(); const c = p.components.find(c => c.id === 'soak')!;
    const ctx = emptySurfaceContext(); ctx.soil.infiltration = { value: 12, unit: 'mm/h', origin: 'user_supplied', source: 'My location test assumption', method: '', date: '' };
    p.science!.surfaces.z2 = ctx;
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Known ordering' };
    const e = emptyInterventionEvidence();
    expect(referencedSoil(p, c, e).number?.value).toBe(null);
    e.soilReference = { zoneId: 'z2', confirmation: 'Same tested location and soil', observation: structuredClone(ctx.soil.infiltration) };
    expect(referencedSoil(p, c, e).number?.value).toBe(12);
    ctx.soil.infiltration.value = 15;
    expect(referencedSoil(p, c, e).stale).toBe(true);
    ctx.soil.infiltration.value = 12; c.treatment.installationZoneId = 'z3';
    expect(referencedSoil(p, c, e).stale).toBe(true);
  });
  it('clears installation and soil references on deletion without destroying old plan snapshots', () => {
    const p = demoProject(); const c = p.components.find(c => c.id === 'tank')!;
    c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Explicit' };
    p.science!.interventions.tank!.soilReference = { zoneId: 'z2', confirmation: 'Same location', observation: emptySurfaceContext().soil.infiltration };
    const next = deleteZone(p, 'z2');
    expect(next.components.find(x => x.id === 'tank')!.treatment!.installationZoneId).toBe(null);
    expect(next.science!.interventions.tank!.soilReference).toBeUndefined();
    expect(projectV2Schema.safeParse(next).success).toBe(true);
  });
  it('updates auto depth labels while preserving deliberately named scenarios', () => {
    let p = demoProject(); const sid = p.scenarios[0]!.id;
    p.scenarios[0]!.name = 'Hujan 50 mm';
    p = saveRain(p, sid, 'Hujan 50 mm', { text: '60', source: 'Scenario test', evidence: 'ASSUMPTION' }, 'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan 60 mm');
    p = saveRain(p, sid, 'Puncak semester', { text: '70', source: 'Scenario test', evidence: 'ASSUMPTION' }, 'Test');
    expect(p.scenarios[0]!.name).toBe('Puncak semester');
  });
  it('flags clogging without changing C or water calculations', () => {
    const p = demoProject(), old = structuredClone(p.parameters);
    p.science!.surfaces.z4 = emptySurfaceContext(); p.science!.surfaces.z4!.porous.clogging = 'observed';
    expect(porousConsistency(p, 'z4').join(' ')).toContain('C');
    expect(p.parameters).toEqual(old);
  });
  it('gives noncausal next tasks rather than automatically changing science from ponding observations', () => {
    const observation = blankFieldEvaluation('o', 'p', 1); observation.after.ponding = 'observed'; observation.condition = 'clogged';
    const original = structuredClone(observation);
    expect(fieldNextActions(observation).map(x => x.step)).toContain('rain');
    expect(fieldNextActions(observation).some(x => x.label.includes('tujuan air'))).toBe(true);
    expect(observation).toEqual(original);
  });
});

function singleRoof() {
  let p = createProjectV2('large-roof', 'One continuous roof', '2026-10-05T00:00:00.000Z');
  const shape = (surface: 'roof' | null) => ({ name: 'One continuous roof', surface, method: 'direct' as const, area: { value: 200, evidence: 'USER_INPUT' as const, source: 'Synthetic horizontal area', note: '' }, coefficient: { value: surface ? .8 : null, evidence: surface ? 'USER_INPUT' as const : 'UNKNOWN' as const, source: surface ? 'Synthetic C' : '', note: '' }, length: { value: null, evidence: 'UNKNOWN' as const, source: '', note: '' }, width: { value: null, evidence: 'UNKNOWN' as const, source: '', note: '' } });
  const polygon = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }];
  p = addShape(p, 'parcel', polygon, true); p = updateShapeData(p, 'parcel', shape(null), () => crypto.randomUUID());
  p = addShape(p, 'roof', polygon); p = updateShapeData(p, 'roof', shape('roof'), () => crypto.randomUUID());
  return saveRain(p, 'rain', 'Hujan 60 mm', { text: '60', evidence: 'ASSUMPTION', source: 'Synthetic event' }, 'Synthetic');
}
function declaredTank(p: ReturnType<typeof singleRoof>, mode: 'ledger' | 'unresolved' | 'parallel' = 'ledger') {
  const added = addTreatment(p, 'storage', 'rain', 'roof');
  const known = (text: string) => ({ text, evidence: 'ASSUMPTION' as const, source: 'Synthetic declared assumption' });
  const c = added.project.components.find(x => x.id === added.id)!;
  let next = saveComponent(added.project, { id: c.id, name: c.name, family: 'storage', targets: ['roof'], siteId: c.installationSiteId!, connection: 'Declared whole catchment route', applicability: 'Synthetic event only', scenarioId: 'rain', capacity: known('6'), cost: emptyInput(), area: emptyInput(), reuse: null, treatment: { installationZoneId: null, sharedSourceMode: mode, allocationNote: 'Declared remaining-volume order, not flow division', catchmentReviewed: true } });
  const saved = next.components.find(x => x.id === c.id)!; if (saved.family !== 'storage') throw new Error('Wrong family');
  const ref = saved.performanceByScenario.rain!.availableStorage, param = next.parameters.find(x => x.id === ref.id)!;
  next = updateScience(next, science => {
    const e = emptyInterventionEvidence(); e.nominalTankCapacity = { value: 8, unit: 'm3', origin: 'user_supplied', source: 'Synthetic tank size', method: '', date: '' };
    e.performance.rain = { origin: 'user-entered', source: 'Synthetic event only', subgradeDependent: null, parameterId: param.id, parameterRevision: param.revision, ...scientificScenarioContext(next, 'rain') };
    science.interventions[c.id] = e;
    science.connections.push({ id: `route-${c.id}`, candidateId: c.id, sourceZoneId: 'roof', destination: { kind: 'intervention', id: c.id }, via: 'gutter-downpipe', origin: 'user_supplied', source: 'Whole source route declared; not surveyed' });
  });
  return { project: next, id: c.id };
}
describe('counterexamples to treatment assumptions', () => {
  it('one 200m2 continuous roof, two 6m3 tanks cannot capture 12m3 from 9.6m3 runoff', () => {
    const a = declaredTank(singleRoof()), b = declaredTank(a.project);
    const plan = snapshotPlan(b.project, [a.id, b.id], 'p', 'Two tanks');
    const result = evaluateEventPlan(b.project, plan, 'rain'); expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.baseline).toBeCloseTo(9.6); expect(result.value.stored).toBeCloseTo(9.6); expect(result.value.residual).toBe(0);
    expect(result.value.components[0]!.stored).toBe(6); expect(result.value.components[1]!.stored).toBeCloseTo(3.6);
    const reverse = evaluateEventPlan(b.project, { ...plan, priority: [b.id, a.id] }, 'rain'); expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value.stored).toBe(result.value.stored);
  });
  it('a sole candidate is not rejected because an unselected draft shares its source', () => {
    const a = declaredTank(singleRoof(), 'unresolved'), b = declaredTank(a.project, 'unresolved');
    expect(evaluateEventPlan(b.project, snapshotPlan(b.project, [a.id], 'p', 'Solo'), 'rain').ok).toBe(true);
    expect(evaluateEventPlan(b.project, snapshotPlan(b.project, [a.id, b.id], 'p', 'Together'), 'rain').ok).toBe(false);
  });
  it('explicit sources replace catchment confirmation; parallel split and oversized storage still withhold benefit', () => {
    const a = declaredTank(singleRoof()), b = declaredTank(a.project, 'parallel');
    expect(evaluateEventPlan(b.project, snapshotPlan(b.project, [a.id, b.id], 'p', 'Parallel'), 'rain').ok).toBe(false);
    const c = a.project.components.find(c => c.id === a.id)!; c.treatment!.catchmentReviewed = null;
    expect(evaluateEventPlan(a.project, snapshotPlan(a.project, [a.id], 'p', 'Unreviewed'), 'rain').ok).toBe(true);
    c.treatment!.catchmentReviewed = true; a.project.science!.interventions[a.id]!.nominalTankCapacity.value = 2;
    expect(evaluateEventPlan(a.project, snapshotPlan(a.project, [a.id], 'p', 'Impossible size'), 'rain').ok).toBe(false);
  });
  it('biopori geometry rejects fractional counts, nonpositive dimensions and source-free known data', () => {
    const e = emptyInterventionEvidence();
    for (const biopori of [{ count: 1.5, diameterCm: null, depthCm: null, source: 'Declared' }, { count: 2, diameterCm: 0, depthCm: null, source: 'Declared' }, { count: 2, diameterCm: 10, depthCm: 60, source: '' }]) expect(interventionEvidenceSchema.safeParse({ ...e, biopori }).success).toBe(false);
    expect(interventionEvidenceSchema.safeParse({ ...e, biopori: { count: null, diameterCm: null, depthCm: null, source: '' } }).success).toBe(true);
  });
  it('stress option space stops explicitly, without silently searching only an easy subset', () => {
    let p = singleRoof(); for (let i = 0; i < 15; i++) p = addTreatment(p, 'storage', 'rain', 'roof').project;
    const search = optimize(p, 'rain'); expect(search.ok).toBe(false);
    if (!search.ok) expect(search.issues[0]!.message).toContain('10.000');
  });
});

it('biopori accepts every declared installation surface except roofs', () => {
  const p=demoProject(), sid=p.scenarios[0]!.id, c=p.components.find(c=>c.id==='soak')!; if(c.family!=='infiltration') throw new Error('Wrong fixture'); c.infiltrationType='biopori'; c.treatment={installationZoneId:null,sharedSourceMode:'ledger',allocationNote:'Declared accounting',catchmentReviewed:true}; c.targets=['z0'];
  expect(assessIntervention(p,c,sid).missing.some(f=>f.ruleId==='BIOPORI_SITE')).toBe(true);
  c.treatment.installationZoneId='z0'; expect(assessIntervention(p,c,sid).reasons.some(f=>f.ruleId==='BIOPORI_SITE')).toBe(true); expect(evaluateEventPlan(p,snapshotPlan(p,[c.id],'p','Roof installation'),sid).ok).toBe(false);
  for(const id of ['z1','z2','z3','z4']) { c.treatment.installationZoneId=id; expect(assessIntervention(p,c,sid).reasons.some(f=>f.ruleId==='BIOPORI_SITE')).toBe(false); expect(assessIntervention(p,c,sid).missing.some(f=>f.ruleId==='BIOPORI_SITE')).toBe(false); }
  c.treatment.installationZoneId='z2'; expect(c.targets).toEqual(['z0']);
  expect(treatmentPlacementIssue(p,c,{x:17,y:7})).toBeNull();
  c.treatment.installationZoneId='z0'; expect(treatmentPlacementIssue(p,c,{x:2,y:2})).toContain('Atap');
});
