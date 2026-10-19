import { describe, it, expect } from 'vitest';
import { buildProjectReport } from './projectReport';
import { reportHtml } from './reportHtml';
import { demoProject, alternativeSearch } from '../direction/productionBridge';
import { snapshotPlan, planningFingerprint, evaluatePlan } from '../domain/planningEngine';
import { parcelFigure } from './reportFigures';
import { reportPdfDefinition } from './reportPdf';

function tankChosen() {
  const p = demoProject(true);
  p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'chosen-tank', 'Tangki pilihan'), decisionNote: 'Talang berada dekat lokasi tangki.', reviewedInputFingerprint: planningFingerprint(p) };
  return p;
}
describe('decision-focused report rescue', () => {
  it('keeps the explicit comparator heading with its bounded comparison table', () => {
    const report = buildProjectReport(tankChosen(), 'r50');
    report.sections.push({id:'comparison',title:'Alternatif pembanding',blocks:[{kind:'text',text:'Satu paket pembanding, atas permintaan pengguna.'},{kind:'table',headers:['Paket','Sisa'],rows:[['Tangki','3,72 m³'],['Tanpa intervensi','6,27 m³']]},{kind:'text',text:'Penjelasan perbedaan.'}]});
    const nodes = reportPdfDefinition(report).content as {stack?:unknown[];unbreakable?:boolean}[];
    const grouped = nodes.find(node => node.stack && JSON.stringify(node.stack).includes('Alternatif pembanding'));
    expect(grouped?.unbreakable).toBe(true); expect(JSON.stringify(grouped)).toContain('6,27 m³');
  });
  it('keeps the parcel section heading and introduction attached to its map in compact PDF layout', () => {
    const report = buildProjectReport(tankChosen(), 'r50');
    const nodes = reportPdfDefinition(report).content as { stack?: { text?: string }[]; unbreakable?: boolean }[];
    const grouped = nodes.find(node => node.stack?.some(child => child.text === 'Persil dan kontribusi permukaan'));
    expect(grouped?.unbreakable).toBe(true); expect(JSON.stringify(grouped)).toContain('<polygon');
  });
  it('does not describe entered-area diagram shapes as measured dimensions in mixed-scale projects', () => {
    const p = tankChosen(); p.zones[0]!.geometryContext = 'schematic-area';
    const html = reportHtml(buildProjectReport(p, 'r50'));
    expect(html).toContain('bentuk area sederhana belum diukur');
    expect(html).not.toContain('Sketsa berskala meter dari dimensi yang dinyatakan');
  });
  it('describes a removed snapshot source without dumping its internal ID in the human summary', () => {
    const p = tankChosen(); p.selectedPlan!.definition.components[0]!.targets = ['removed-source-opaque-id'];
    p.selectedPlan!.reviewedInputFingerprint = 'older-input';
    const html = reportHtml(buildProjectReport(p, 'r50'));
    expect(html).not.toContain('removed-source-opaque-id');
    expect(html).toContain('Area sumber tidak tersedia');
    expect(html).toContain('belum ditinjau ulang');
  });
  it('maps only declared selected treatment locations and retains schematic source relationships in summary', () => {
    const p = tankChosen(), tank = p.selectedPlan!.definition.components[0]!;
    tank.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: '' };
    tank.placement = { point: { x: 80, y: 30 }, footprint: null, context: 'schematic' };
    const map = parcelFigure(p, p.selectedPlan!.definition);
    expect(map).toContain('>I1</text>'); expect(map).not.toContain('>I2</text>');
    expect(map).toContain('stroke-width="3"'); expect(map).not.toContain('<path');
    const r = buildProjectReport(p, 'r50');
    expect(r.sections.find(s => s.id === 'parcel')!.blocks.some(b => b.kind === 'figure')).toBe(true);
    expect(reportHtml(r)).toContain('Lokasi: Tanah timur');
    tank.placement = null; tank.treatment.installationZoneId = null;
    expect(parcelFigure(p, p.selectedPlan!.definition)).not.toContain('>I1</text>');
    expect(reportHtml(buildProjectReport(p, 'r50'))).toContain('Lokasi: belum dinyatakan');
  });
  it('defaults to a concise human result with material conditions, never a provenance or method dump', () => {
    const p = tankChosen(), before = structuredClone(p), report = buildProjectReport(p, 'r50');
    expect(report.sections.map(s => s.id)).toEqual(['summary', 'parcel', 'plan', 'rain', 'verification']);
    const html = reportHtml(report);
    expect(html).toContain('Tangki atap');expect(html).toContain('Talang berada dekat lokasi tangki.');
    expect(html).not.toContain('UNKNOWN');expect(html).not.toContain('user_supplied');expect(html).not.toContain('event-ledger-v1');
    expect(html).not.toContain('disimpan untuk nanti');expect(html).not.toContain('Alur data dan keputusan');
    expect(html).toContain('luapan');expect(html).toContain('Tidak memprediksi');
    expect(p).toEqual(before);
  });
  it('never borrows a selected decision note for active draft or invents a human reason', () => {
    const p = tankChosen();
    const active=reportHtml(buildProjectReport(p, 'r50', { planScope: 'active' }));
    expect(active).not.toContain('Talang berada dekat lokasi tangki.');expect(active).not.toContain('Belum ada rencana pilihan pengguna');expect(active).toContain('Draf intervensi aktif');
    p.selectedPlan!.decisionNote = 'Dipilih pengguna setelah membandingkan trade-off.';
    expect(reportHtml(buildProjectReport(p, 'r50'))).not.toContain('Alasan Anda');
  });
  it('shows resource use against explicit limits, including valid zero limits without a fictitious percentage',()=>{
    const p=tankChosen(),html=reportHtml(buildProjectReport(p,'r50'));
    expect(html).toContain('25%');expect(html).toContain('8,33%');expect(html).toContain('Rp3.000.000 / Rp12.000.000');
    p.selectedPlan={definition:snapshotPlan(p,[],'zero','Tanpa intervensi'),decisionNote:'',reviewedInputFingerprint:planningFingerprint(p)};
    for(const ref of [p.constraints.budget,p.constraints.usableArea])p.parameters.find(v=>v.id===ref.id)!.value=0;
    p.selectedPlan.reviewedInputFingerprint=planningFingerprint(p);
    const zero=reportHtml(buildProjectReport(p,'r50'));expect(zero).not.toContain('NaN');expect(zero).not.toContain('Infinity');
  });
  it('can report one explicit current alternative without changing the selected plan or falling back on invalid identity', () => {
    const p = tankChosen(), search = alternativeSearch(p, 'r50');
    const alt = search.rows.find(a => a.plan.components.some(c => c.enabled && c.id === 'garden'))!;
    const before = structuredClone(p), report = buildProjectReport(p, 'r50', { planScope: 'alternative', planId: alt.plan.id });
    expect(report.metrics?.residual).toBe(alt.balance.residual);expect(reportHtml(report)).not.toContain('Talang berada dekat lokasi tangki.');
    const invalid = buildProjectReport(p, 'r50', { planScope: 'alternative', planId: 'deleted-choice' });
    expect(invalid.metrics).toBeNull();expect(invalid.status).toContain('tidak tersedia');expect(p).toEqual(before);
  });
  it('retains exact canonical results and full optional technical traceability with only scoped candidate routes', () => {
    const p = tankChosen(), full = buildProjectReport(p, 'r50', { detail: 'detailed', includeSources: true });
    const value = evaluatePlan(p, p.selectedPlan!.definition, 'r50');expect(value.ok).toBe(true);if (!value.ok) return;
    expect(full.metrics?.residual).toBe(value.value.residual);expect(full.sections.some(s => s.id === 'provenance')).toBe(true);
    const trace = full.sections.find(s => s.id === 'trace')!;
    const words = JSON.stringify(trace);
    expect(words).toContain('Gedung belajar');expect(words).not.toContain('Halaman kegiatan → Permukaan berpori');
    expect(words).not.toContain('Tanah timur → Sumur / area resapan');
  });
});
