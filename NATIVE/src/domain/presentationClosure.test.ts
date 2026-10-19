import { describe, it, expect } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { saveComponent, readInput } from './planningAuthoring';
import { assessFieldEvaluation, blankFieldEvaluation } from './fieldEvaluation';
import { evidenceForClaim, authoritativeReferences, validateEvidenceRegistry } from './evidenceRegistry';
import { methodNotes } from './methodTraceability';

describe('supervisor presentation closure', () => {
  it('changing well to biopori does not inherit other-scenario capacity', () => {
    const p = demoProject(), c = p.components.find(c => c.id === 'soak')!;
    expect(Object.keys(c.performanceByScenario)).toContain('r100');
    const next = saveComponent(p, {
      id: c.id, name: 'Biopori', family: 'infiltration', infiltrationType: 'biopori',
      targets: c.targets, siteId: c.installationSiteId!, connection: c.connectionNote,
      applicability: 'New biopori estimate for this event, not a transferred well value',
      scenarioId: 'r50', reuse: null, cost: {text:'',source:'',evidence:'USER_INPUT'},
      area: {text:'',source:'',evidence:'USER_INPUT'}, capacity: {text:'',source:'',evidence:'USER_INPUT'},
    });
    const biopori = next.components.find(c => c.id === 'soak')!;
    expect(biopori.family).toBe('infiltration');
    expect(Object.keys(biopori.performanceByScenario)).toEqual(['r50']);
    expect(readInput(next, biopori.totalCost).text).toBe('');
    const perf = biopori.performanceByScenario.r50!;
    expect('infiltrationCapacity' in perf && readInput(next, perf.infiltrationCapacity, 'r50').text).toBe('');
    expect(p.components.find(c=>c.id==='soak')!.performanceByScenario.r100).toBeDefined();
  });
  it('biopori has a discoverable method and separately classified laboratory evidence', () => {
    expect(validateEvidenceRegistry()).toEqual([]);
    expect(methodNotes.find(m=>m.id==='biopori')?.claimIds).toContain('CLAIM-BIOPORI');
    expect(evidenceForClaim('CLAIM-BIOPORI')[0]?.id).toBe('STUDY-BIOPORI-2014');
    expect(authoritativeReferences.find(r=>r.id==='STD-SNI-8456-2025')?.limitation).toContain('belum ditinjau');
  });
  const observed = () => {
    const v=blankFieldEvaluation('observation','plan',1);
    v.before.date='2026-09-01';v.after.date='2026-09-02';
    v.before.rain={...v.before.rain,value:60,origin:'user_supplied',source:'Synthetic test'};
    v.after.rain=structuredClone(v.before.rain);
    v.before.ponding='observed';v.after.ponding='not-observed';
    v.comparable=true;v.comparisonBasis='Synthetic comparable events';
    v.installedAsPlanned=true;v.installationNote='Synthetic inspection';
    return v;
  };
  it.each(['before','after'] as const)('no improvement credit for a zero-rain %s record', side => {
    const v=observed(); v[side].rain.value=0;
    expect(assessFieldEvaluation(v).status).toBe('INSUFFICIENT_DATA');
    expect(assessFieldEvaluation(v).explanation).toContain('0 mm');
    expect(v[side].rain.value).toBe(0);
    v[side].rain.value=60; expect(assessFieldEvaluation(v).status).toBe('INDICATION_IMPROVED');
    v[side].rain.value=null; expect(assessFieldEvaluation(v).status).toBe('INSUFFICIENT_DATA');
  });
  it.each(['2026-08-31','2026-09-01'])('rejects nonchronological event comparison %s', date => {
    const v=observed();v.after.date=date;
    expect(assessFieldEvaluation(v).status).toBe('INSUFFICIENT_DATA');
    expect(assessFieldEvaluation(v).explanation).toContain('Tanggal sesudah');
    v.after.date='2026-09-02';expect(assessFieldEvaluation(v).status).toBe('INDICATION_IMPROVED');
  });
});
