import { describe, it, expect } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { emptyInterventionEvidence, unknownNumber, scientificNumberSchema } from './scientificContract';
import { migrateProject } from './migration';
import { updateScience, observedNumber, rainfallAverageIntensity } from './scientificAuthoring';
import { assessIntervention, screeningRules } from './feasibility';
import { routingIssues, sourceConnects } from './sourceRouting';
import { evaluatePlan, snapshotPlan, optimize, planningFingerprint } from './planningEngine';
import { scientificClaims, validateEvidenceRegistry } from './evidenceRegistry';
import { blankFieldEvaluation, assessFieldEvaluation } from './fieldEvaluation';
import { projectBackup } from '../persistence/portable';
import { scientificSummary } from './scientificExport';
describe('scientific revision', () => {
  it('has an explicitly synthetic teaching case covering preliminary, conditional and missing evidence', () => {
    const p = demoProject(true, true);
    expect(p.mode).toBe('demo');
    expect(assessIntervention(p, p.components.find(c => c.id === 'tank')!, 'r50').status).toBe('FEASIBLE_PRELIMINARY');
    expect(assessIntervention(p, p.components.find(c => c.id === 'garden')!, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
    expect(assessIntervention(p, p.components.find(c => c.id === 'soak')!, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
  });
  it('migrates legacy deterministically, retaining every original scientific input', () => {
    const old = demoProject(); delete old.science;
    const a = migrateProject(old, '2026-10-03T00:00:00.000Z');
    expect(a).toEqual(migrateProject(old, '2026-10-04T00:00:00.000Z'));
    expect(a.parameters).toEqual(old.parameters); expect(a.zones).toEqual(old.zones); expect(a.components).toEqual(old.components);
    expect(a.science?.legacyNeedsVerification).toEqual(old.components.map(c => c.id).sort());
    expect(assessIntervention(a, a.components[0]!, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
    expect(migrateProject(JSON.parse(projectBackup(a)).project, '')).toEqual(a);
  });
  it('rejects malformed/future science instead of silently removing it', () => {
    const p = demoProject();
    expect(() => migrateProject({ ...p, science: { ...p.science, schemaVersion: 999 } }, '')).toThrow();
    expect(scientificNumberSchema.safeParse({ ...unknownNumber('mm'), value: 0 }).success).toBe(false);
    expect(() => observedNumber('4', 'mm/h', 'measured', 'test')).toThrow();
    expect(observedNumber('', 'mm', 'user_supplied', 'note').value).toBeNull();
  });
  it('computes average event intensity only, preserves zero and rejects zero duration', () => {
    const duration = observedNumber('120', 'minutes', 'user_supplied', 'declared event');
    expect(rainfallAverageIntensity(60, duration)?.value).toBe(30);
    expect(rainfallAverageIntensity(0, duration)?.value).toBe(0);
    expect(rainfallAverageIntensity(null, duration)).toBeNull();
    expect(rainfallAverageIntensity(60, { ...duration, value: 0 })).toBeNull();
    expect(() => observedNumber('0', 'minutes', 'user_supplied', 'test')).toThrow();
    expect(rainfallAverageIntensity(60, { ...duration, unit: 'mm' })).toBeNull();
  });
  it('requires explicit connections, rejects contradictory routes and cycles', () => {
    const p = demoProject(); expect(sourceConnects(p, 'z0', 'tank')).toBe(true);
    p.science!.connections = []; expect(sourceConnects(p, 'z0', 'tank')).toBe(false);
    p.science!.connections = ['z0', 'z1'].map((id, i) => ({ id, sourceZoneId: id, destination: { kind: 'zone', id: i === 0 ? 'z1' : 'z0' }, via: 'other', origin: 'user_supplied', source: 'Explicit test route' }));
    expect(routingIssues(p).join()).toContain('siklus'); expect(() => migrateProject(p, '')).toThrow();
    p.science!.connections[1]!.sourceZoneId = 'z0'; expect(routingIssues(p).join()).toContain('bertentangan');
  });
  it('models declared capacity with unknown soil and rejects known unsuitable groundwater', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    expect(assessIntervention(p, c, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
    p.science!.interventions[c.id]!.soilInfiltration = unknownNumber('mm/h');
    expect(assessIntervention(p, c, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
    expect(evaluatePlan(p, snapshotPlan(p, [c.id], 'p', 'Test'), 'r50').ok).toBe(true);
    p.science!.interventions[c.id]!.groundwaterAssessment = 'unsuitable';
    expect(assessIntervention(p, c, 'r50').status).toBe('INFEASIBLE_WITH_AVAILABLE_DATA');
  });
  it('rejects oversized tank and capacity evidence from a different revision', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'tank')!;
    p.science!.interventions[c.id]!.nominalTankCapacity.value = 1;
    expect(assessIntervention(p, c, 'r50').status).toBe('INFEASIBLE_WITH_AVAILABLE_DATA');
    p.science!.interventions[c.id]!.nominalTankCapacity.value = 10;
    p.parameters.find(x => x.id === p.science!.interventions[c.id]!.performance.r50!.parameterId)!.revision++;
    expect(assessIntervention(p, c, 'r50').missing.some(x => x.ruleId === 'PERFORMANCE')).toBe(true);
  });
  it('keeps existing porous separate and bounds converted area', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'porous')!;
    expect(assessIntervention(p, c, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
    c.targets = ['z4']; expect(assessIntervention(p, c, 'r50').status).toBe('INFEASIBLE_WITH_AVAILABLE_DATA');
    c.targets = ['z3']; expect(assessIntervention(p, c, 'r50').status).toBe('INFEASIBLE_WITH_AVAILABLE_DATA');
    c.targets = ['z1']; p.parameters.find(x => x.id === c.occupiedArea.id)!.value = 1000;
    expect(evaluatePlan(p, snapshotPlan(p, [c.id], 'p', 'Test'), 'r50').ok).toBe(false);
    p.parameters.find(x => x.id === c.occupiedArea.id)!.value = 8;
    p.science!.interventions[c.id] = emptyInterventionEvidence(); expect(assessIntervention(p, c, 'r50').status).toBe('FEASIBLE_WITH_CONDITIONS');
  });
  it('excludes incomplete candidates without poisoning complete choices, conserves every feasible ledger', () => {
    const p = demoProject(); p.science!.interventions.soak!.groundwaterAssessment = 'unsuitable';
    const a = optimize(p, 'r50'); expect(a.ok).toBe(true); expect(a).toEqual(optimize(p, 'r50'));
    if (!a.ok) return;
    expect(a.value.excluded.some(x => x.plan.components.some(c => c.id === 'soak'))).toBe(true);
    expect(a.value.alternatives.some(x => x.plan.components.some(c => c.id === 'tank'))).toBe(true);
    for (const x of a.value.alternatives) { expect(x.plan.components.some(c => c.id === 'soak')).toBe(false); expect(x.balance.stored + x.balance.reused + x.balance.infiltrated + x.balance.residual).toBeCloseTo(x.balance.baseline, 12); }
    expect(p.selectedPlan).toBeNull();
  });
  it('invalidates decisions on science changes, not on independent field records', () => {
    const p = demoProject(), before = planningFingerprint(p);
    const observed = updateScience(p, s => { s.observations.push(blankFieldEvaluation('obs', 'p', 1)); });
    expect(planningFingerprint(observed)).toBe(before);
    observed.science!.interventions.tank!.maintenance = 'New condition'; expect(planningFingerprint(observed)).toBe(before);
    observed.science!.interventions.tank!.condition='damaged';expect(planningFingerprint(observed)).not.toBe(before);
  });
  it('can report preliminary feasibility without claiming certification, and rechecks duration changes', () => {
    const p = demoProject(), tank = p.components.find(c => c.id === 'tank')!;
    const e = p.science!.interventions.tank!;
    e.performance.r50!.origin = 'measured'; e.performance.r50!.method = 'Declared test measurement'; e.performance.r50!.date = '2026-09-01';
    e.fieldVerified = true; e.verificationSource = 'Declared field check'; e.overflow = { kind: 'drainage', note: 'Declared drainage route' };
    if (tank.family !== 'storage') throw new Error('fixture'); tank.waterUse = 'irrigation'; tank.drawdown = 'planned';
    expect(assessIntervention(p, tank, 'r50').status).toBe('FEASIBLE_PRELIMINARY');
    const before = planningFingerprint(p); p.science!.connections.reverse(); expect(planningFingerprint(p)).toBe(before);
    p.science!.rainfall.r50 = observedNumber('120', 'minutes', 'user_supplied', 'Declared duration');
    expect(assessIntervention(p, p.components.find(c => c.id === 'soak')!, 'r50').status).toBe('MORE_DATA_REQUIRED');
    expect(assessIntervention(p, tank, 'r50').status).toBe('FEASIBLE_PRELIMINARY');
  });
  it('preserves frozen performance evidence for a declared size variant while rechecking changed site context', () => {
    const p = demoProject(), old = snapshotPlan(p, ['tank'], 'variant', 'Old tank size');
    const tank = p.components.find(c => c.id === 'tank')!;
    if (tank.family !== 'storage') throw new Error('fixture');
    const parameter = p.parameters.find(x => x.id === tank.performanceByScenario.r50!.availableStorage.id)!;
    parameter.value = 5; parameter.revision++;
    p.science!.interventions.tank!.performance.r50!.parameterRevision = parameter.revision;
    expect(evaluatePlan(p, old, 'r50').ok).toBe(true);
    p.science!.interventions.tank!.condition = 'damaged'; expect(evaluatePlan(p, old, 'r50').ok).toBe(false);
  });
  it('traces each rule and exports unknowns, evidence and field limitations', () => {
    expect(validateEvidenceRegistry()).toEqual([]);
    for (const [, claimId] of screeningRules) expect(scientificClaims.some(c => c.id === claimId && c.evidenceIds.length)).toBe(true);
    const p = demoProject(), report = scientificSummary(p, snapshotPlan(p, ['tank'], 'p', 'Plan'), 'r50').join('\n');
    expect(report).toContain('UNKNOWN'); expect(report).toContain('J-RWH-2017'); expect(report).toContain('bukan debit puncak');
  });
  it('never claims causal proof or model validation from before/after observations', () => {
    const v = blankFieldEvaluation('obs', 'p', 1);
    expect(assessFieldEvaluation(v).status).toBe('INSUFFICIENT_DATA');
    v.before.date = '2026-09-01'; v.after.date = '2026-09-02';
    v.before.rain = observedNumber('60', 'mm', 'user_supplied', 'declared test'); v.after.rain = structuredClone(v.before.rain);
    v.comparable = true; v.comparisonBasis = 'Declared similar rain, initial conditions and method'; v.installedAsPlanned = true; v.installationNote = 'checked';
    v.before.ponding = 'observed'; v.after.ponding = 'not-observed';
    expect(assessFieldEvaluation(v).status).toBe('INDICATION_IMPROVED'); expect(assessFieldEvaluation(v).explanation).toContain('faktor lain');
    v.before.ponding = 'not-observed'; expect(assessFieldEvaluation(v).status).toBe('INSUFFICIENT_DATA');
    v.condition = 'clogged'; expect(assessFieldEvaluation(v).status).toBe('REVIEW_NEEDED');
  });
});
