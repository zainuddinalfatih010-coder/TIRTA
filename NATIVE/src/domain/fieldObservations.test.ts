import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { projectV2Schema } from './projectV2';
import { productionBaseline } from './productionBaseline';
import { emptySurfaceContext } from './scientificContract';
import { fieldObservationGuidance, recordFieldObservation } from './fieldObservations';
import { buildProjectReport } from '../report/projectReport';
import { reportHtml } from '../report/reportHtml';
import { planningFingerprint, snapshotPlan } from './planningEngine';

describe('qualitative field context without invented science', () => {
  it('accepts old contexts without requiring or fabricating a field observation', () => {
    const p = demoProject(); p.science!.surfaces.z2 = emptySurfaceContext();
    expect(projectV2Schema.parse(p).science!.surfaces.z2!.fieldObservation).toBeUndefined();
    expect(fieldObservationGuidance(p, ['z2'])).toBeNull();
  });
  it('changes the next field question, not coefficients, infiltration, capacity or event volumes', () => {
    const p = demoProject(), before = structuredClone(p), baseline = productionBaseline(p, 'r50');
    const q = recordFieldObservation(p, 'z2', { condition: 'ponding', note: 'Air tertahan dekat pintu.' });
    expect(q.parameters).toEqual(p.parameters); expect(q.components).toEqual(p.components);
    expect(productionBaseline(q, 'r50')).toEqual(baseline); expect(p).toEqual(before);
    expect(fieldObservationGuidance(q, ['z2'])?.nextQuestion).toContain('tertahan');
    const concentrated = recordFieldObservation(q, 'z2', { condition: 'concentrated-runoff', note: '' });
    expect(fieldObservationGuidance(concentrated, ['z2'])?.field).toBe('connection');
    expect(fieldObservationGuidance(recordFieldObservation(q, 'z2', { condition: 'no-known-issue', note: '' }), ['z2'])).toBeNull();
  });
  it('round-trips observations and rejects numeric/measurement claims in this qualitative schema', () => {
    const q = recordFieldObservation(demoProject(), 'z2', { condition: 'ponding', note: '<script>example</script>' });
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(q)))).toEqual(q);
    const invalid = structuredClone(q) as unknown as { science: { surfaces: Record<string, { fieldObservation: object }> } };
    invalid.science.surfaces.z2!.fieldObservation = { condition: 'ponding', note: '', depth: 1 };
    expect(projectV2Schema.safeParse(invalid).success).toBe(false);
    expect(() => recordFieldObservation(q, 'deleted-zone', { condition: 'ponding', note: '' })).toThrow();
  });
  it('includes material field context in a concise human report without claiming the calculated volume resolves ponding', () => {
    const p = recordFieldObservation(demoProject(true), 'z2', { condition: 'ponding', note: 'Air tertahan dekat pintu.' });
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'chosen-tank', 'Tangki pilihan'), decisionNote: '', reviewedInputFingerprint: planningFingerprint(p) };
    const r = buildProjectReport(p, 'r50'), html = reportHtml(r);
    expect(html).toContain('Air sering tertahan'); expect(html).toContain('Air tertahan dekat pintu.');
    expect(html).toContain('Pengamatan ini tidak menentukan');
    expect(r.sections.find(s => s.id === 'parcel')!.blocks.some(b => b.kind === 'figure')).toBe(true);
    const map = r.sections.find(s => s.id === 'parcel')!.blocks.find(b => b.kind === 'figure');
    expect(map?.kind === 'figure' ? map.caption : '').toContain('skematis');
  });
  it('does not display an intervention balance or fake zero percentages when event capacity is unknown', () => {
    const p = demoProject(true), tank = p.components.find(c => c.id === 'tank')!;
    if (tank.family !== 'storage') throw new Error('fixture');
    const ref = tank.performanceByScenario.r50!.availableStorage;
    p.parameters.find(v => v.id === ref.id)!.value = null; p.parameters.find(v => v.id === ref.id)!.evidence = 'UNKNOWN'; ref.evidence = 'UNKNOWN';
    const r = buildProjectReport(p, 'r50', { planScope: 'active' });
    expect(r.metrics).toBeNull();
    expect(r.sections.find(s => s.id === 'summary')!.blocks.some(b => b.kind === 'figure')).toBe(false);
    expect(reportHtml(r)).toContain('Dampak belum dapat dihitung');
  });
});
