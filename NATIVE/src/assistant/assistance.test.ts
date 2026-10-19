import { describe, expect, it } from 'vitest';
import { demoProject, setActiveComponents } from '../direction/productionBridge';
import { optimize, evaluatePlan } from '../domain/planningEngine';
import { answerLocally, applyProposal, packageCandidates, proposalFor } from './assistance';
import { appKnowledge, referenceFor, sourcesFor } from './knowledge';
const fixture = () => setActiveComponents(demoProject(true), ['tank', 'soak', 'garden', 'porous']);

describe('TIRTA assistance without model calls', () => {
  it('answers application help and current runoff from the engine, not generated data', () => {
    const p = fixture(), search = optimize(p, 'r50');
    expect(search.ok).toBe(true);
    expect(answerLocally('Cara hapus zona pakai Delete?', p, 'r50', [])?.title).toContain('Hapus');
    expect(answerLocally('Simpan data di mana?', p, 'r50', [])?.text).toContain('browser');
    expect(answerLocally('Dari mana angka limpasan?', p, 'r50', [])?.text).toContain('Pada hujan aktif');
    expect(answerLocally('Analisis mendalam bagaimana jika kapasitas berbeda?', p, 'r50', [])).toBeNull();
    expect(answerLocally('Topik yang tidak ada hubungan dengan aplikasi', p, 'r50', [])).toBeNull();
  });
  it('keeps unknown inputs and source identity explicit', () => {
    const p = fixture(); const coefficient = p.parameters.find(x => x.id === p.zones[0]!.coefficient.id)!; coefficient.value = null; coefficient.evidence = 'UNKNOWN'; coefficient.source = ''; p.zones[0]!.coefficient.evidence = 'UNKNOWN';
    const answer = answerLocally('Data apa yang masih kurang?', p, 'r50', []);
    expect(answer?.text).toContain('belum');
    expect(answer?.action?.destination).toBe('studio');
    for (const item of appKnowledge) if (item.claimId) expect(sourcesFor([item.claimId]).length).toBeGreaterThan(0);
    expect(referenceFor('invented-paper')).toBeUndefined();
  });
  it('does not hide proposal-core permeable alternatives from grounded package candidates', () => {
    const p = fixture(), search = optimize(p, 'r50');
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    const permeable = search.value.alternatives.filter(a => a.plan.components.some(c => c.enabled && c.family === 'permeable'));
    expect(permeable.length).toBeGreaterThan(0);
    expect(packageCandidates(p, permeable, 'r50').length).toBeGreaterThan(0);
  });
  it('applies a declared engine package without altering scientific input and rejects forged/stale proposals', () => {
    const p = fixture(), search = optimize(p, 'r50');
    if (!search.ok) throw new Error('Fixture invalid');
    const candidate = search.value.alternatives.find(a => a.plan.components.length > 0)!;
    const receipt = proposalFor(p, 'r50', candidate.plan);
    const before = evaluatePlan(p, receipt.plan, 'r50');
    const applied = applyProposal(p, 'r50', receipt);
    expect(applied.selectedPlan?.definition.id).toBe(candidate.plan.id);
    expect(applied.parameters).toEqual(p.parameters); expect(applied.components).toEqual(p.components);
    expect(evaluatePlan(applied, receipt.plan, 'r50')).toEqual(before);
    expect(p.selectedPlan).toBeNull();
    expect(() => applyProposal(p, 'r100', receipt)).toThrow(/hujan berubah/);
    const changed = structuredClone(p); changed.parameters[0]!.value = (changed.parameters[0]!.value??0)+1;
    expect(() => applyProposal(changed, 'r50', receipt)).toThrow(/Data/);
    const forged = structuredClone(receipt); forged.plan.name = 'Injected plan';
    expect(() => applyProposal(p, 'r50', forged)).toThrow(/Definisi paket/);
    const costChoice=applyProposal(p,'r50',proposalFor(p,'r50',candidate.plan,'cost'));
    expect(costChoice.selectedPlan?.decisionNote).toContain('biaya terendah');
    expect(costChoice.selectedPlan?.decisionNote).not.toContain('sisa limpasan terendah');
  });
});
