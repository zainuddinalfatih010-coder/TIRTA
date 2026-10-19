import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { planningFingerprint, snapshotPlan } from './planningEngine';
import { workflowReadiness } from './workflowReadiness';

const search = { evaluated: 0, rows: [], issues: [] };
describe('field journey navigation readiness', () => {
  it('opens an explicitly chosen baseline-only plan despite a broken unrelated current option choice', () => {
    const p = demoProject();
    p.components.find(c => c.id === 'tank')!.enabled = false;
    p.selectedPlan = { definition: snapshotPlan(p, [], 'none', 'Tanpa intervensi'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    const ready = workflowReadiness(p, 'r50', search);
    expect(ready.alternatives.length).toBeGreaterThan(0);
    expect(ready.impact).toEqual([]);
  });
  it('opens a supported selected tank despite unrelated disabled options still needing repair', () => {
    const p = demoProject();
    p.components.find(c => c.id === 'garden')!.enabled = false;
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'tank-choice', 'Tangki'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    expect(workflowReadiness(p, 'r50', search).impact).toEqual([]);
  });
  it('still reports stale selection before unrelated option-space failures', () => {
    const p = demoProject();
    p.selectedPlan = { definition: snapshotPlan(p, [], 'none', 'Tanpa intervensi'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    p.components.find(c => c.id === 'tank')!.enabled = false;
    expect(workflowReadiness(p, 'r50', search).impact[0]!.message).toContain('Data berubah');
  });
  it('never bypasses unknown baseline rain for a current selected plan', () => {
    const p = demoProject(), ref = p.scenarios[0]!.rainfall;
    Object.assign(p.parameters.find(x => x.id === ref.id)!, { value: null, evidence: 'UNKNOWN' }); ref.evidence = 'UNKNOWN';
    p.selectedPlan = { definition: snapshotPlan(p, [], 'none', 'Tanpa intervensi'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    expect(workflowReadiness(p, 'r50', search).impact[0]!.stage).toBe('rain');
  });
  it('never bypasses resource limits in the chosen plan itself', () => {
    const p = demoProject();
    p.parameters.find(x => x.id === p.constraints.budget.id)!.value = 0;
    p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'tank-choice', 'Tangki'), reviewedInputFingerprint: planningFingerprint(p), decisionNote: 'Pilihan pengguna' };
    expect(workflowReadiness(p, 'r50', search).impact.length).toBeGreaterThan(0);
  });
  it('offers data-first area recovery for a schematic-area gap without inventing a remainder zone', () => {
    const p = demoProject(), zone = p.zones[0]!;
    zone.geometryContext = 'schematic-area';
    p.parameters.find(x => x.id === zone.area.id)!.value = 30;
    const before = JSON.stringify(p), result = workflowReadiness(p, 'r50', search);
    const coverage = result.rain.find(i => i.field === 'coverage')!;
    expect(coverage.message).toContain('30 m² belum menjadi zona');
    expect(coverage.message).toContain('Tambahkan area sederhana');
    expect(coverage.message).not.toContain('Gambarkan zona');
    expect(JSON.stringify(p)).toBe(before);
  });
});
