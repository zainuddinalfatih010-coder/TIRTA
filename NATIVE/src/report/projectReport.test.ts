import { describe,it,expect } from 'vitest';
import { buildProjectReport } from './projectReport';
import { reportHtml } from './reportHtml';
import { reportPdfDefinition } from './reportPdf';
import { demoProject, money } from '../direction/productionBridge';
import { evaluatePlan, snapshotPlan, planningFingerprint } from '../domain/planningEngine';
import { createProjectV2 } from '../domain/projectV2';
import { saveRain } from '../domain/planningAuthoring';
const time='2026-10-05T05:00:00.000Z';
function complete() {
  const p=demoProject(true);p.createdAt=time;p.updatedAt=time;
  const plan=snapshotPlan(p,p.components.filter(c=>c.enabled).map(c=>c.id),'report-choice','Paket pilihan pengguna');
  p.selectedPlan={definition:plan,decisionNote:'Periksa biaya dan ruang bersama pembina.',reviewedInputFingerprint:planningFingerprint(p)};
  return p;
}
describe('canonical project reporting',()=>{
  it('describes a calculable water draft separately from an unknown comparison budget',()=>{
    const p=demoProject();p.components.forEach(c=>{c.enabled=c.id==='tank';});
    const budget=p.parameters.find(v=>v.id===p.constraints.budget.id)!;budget.value=null;budget.evidence='UNKNOWN';budget.source='';p.constraints.budget.evidence='UNKNOWN';
    const r=buildProjectReport(p,'r50',{detail:'summary',includeSources:false}),summary=JSON.stringify(r.sections.find(s=>s.id==='summary'));
    expect(r.state).toBe('draft');expect(r.metrics).toBeNull();expect(summary).toContain('Neraca air draf dapat dihitung');expect(summary).toContain('Paket belum dapat dibandingkan');expect(summary).not.toContain('Dampak belum dapat dihitung');
  });
  it('keeps material uncertainty next to the summary in the PDF without mutating report order or including empty tables',()=>{
    const r=buildProjectReport(complete(),'r50',{detail:'summary',includeSources:false}),before=structuredClone(r);
    const printed=JSON.stringify(reportPdfDefinition(r));
    expect(printed.indexOf('Kesimpulan proyek')).toBeLessThan(printed.indexOf('Asumsi penting dan pemeriksaan berikutnya'));
    expect(printed.indexOf('Asumsi penting dan pemeriksaan berikutnya')).toBeLessThan(printed.indexOf('Persil dan kontribusi permukaan'));
    expect(r).toEqual(before);
  });
  it('keeps small positive costs readable without changing zero or million-scale labels',()=>{
    for(const [amount,label] of [[0,'Rp0 jt'],[1,'Rp1'],[1000,'Rp1.000'],[2000,'Rp2.000'],[999999,'Rp999.999'],[1000000,'Rp1 jt'],[3000000,'Rp3 jt'],[10500000,'Rp10,5 jt'],[.001,'Rp0,001']] as const)expect(money(amount)).toBe(label);
  });
  it('preserves coefficient precision in report tables, provenance, HTML and PDF, including when the baseline is unavailable',()=>{
    for(const coefficient of [.175,.12345,0,1]){
      const p=demoProject(true),z=p.zones.find(z=>z.id==='z2')!;
      p.parameters.find(v=>v.id===z.coefficient.id)!.value=coefficient;
      const before=structuredClone(p),label=String(coefficient).replace('.',',');
      for(const rainfall of [50,null]){
        const q=rainfall===null ? saveRain(p,'r50','Hujan belum diketahui',{text:'',evidence:'UNKNOWN',source:''},'') : p;
        const input=structuredClone(q),r=buildProjectReport(q,'r50',{detail:'detailed',includeSources:true});
        const parcel=r.sections.find(s=>s.id==='parcel')!.blocks.find(b=>b.kind==='table')!;
        expect(parcel.kind).toBe('table');if(parcel.kind!=='table')throw new Error('Missing parcel table');
        expect(parcel.rows[2]![2]).toBe(label);
        const provenance=r.sections.find(s=>s.id==='provenance')!.blocks.find(b=>b.kind==='table')!;
        expect(provenance.kind).toBe('table');if(provenance.kind!=='table')throw new Error('Missing provenance table');
        expect(provenance.rows.find(row=>row[0]===`${z.name} · C`)?.[1]).toBe(label);
        expect(reportHtml(r)).toContain(`<td>${label}</td>`);
        expect(JSON.stringify(reportPdfDefinition(r).content)).toContain(`"text":"${label}"`);
        expect(q).toEqual(input);
      }
      expect(p).toEqual(before);
    }
  });
  it('reports the explicit choice or active draft and only one requested comparison without changing the stored choice',()=>{
    const p=complete();
    p.selectedPlan={definition:snapshotPlan(p,[],'baseline-choice','Tanpa intervensi'),decisionNote:'Pilihan pembanding',reviewedInputFingerprint:planningFingerprint(p)};
    const before=structuredClone(p),selected=buildProjectReport(p,'r50'),draft=buildProjectReport(p,'r50',{planScope:'active'});
    expect(selected.planName).toBe('Tanpa intervensi');expect(selected.metrics?.residual).toBe(selected.metrics?.baseline);
    expect(draft.state).toBe('draft');expect(draft.metrics!.residual).toBeLessThan(selected.metrics!.residual);expect(draft.sections.find(s=>s.id==='plan')).toBeDefined();
    expect(selected.sections.some(s=>s.id==='comparison')).toBe(false);expect(draft.sections.some(s=>s.id==='comparison')).toBe(false);
    const invalid=buildProjectReport(p,'r50',{comparisonPlanId:'no-longer-available'});
    expect(reportHtml(invalid)).toContain('Paket pembanding tidak tersedia');expect(p).toEqual(before);
  });
  it('reuses the engine, preserves snapshots, user choice and conservation without mutating',()=>{
    const p=complete(),before=structuredClone(p),r=buildProjectReport(p,'r50',{detail:'detailed',includeSources:true});
    const b=evaluatePlan(p,p.selectedPlan!.definition,'r50');expect(b.ok).toBe(true);if(!b.ok)return;
    expect(r.metrics).toMatchObject({baseline:b.value.baseline,stored:b.value.stored,reused:b.value.reused,infiltrated:b.value.infiltrated,residual:b.value.residual});
    expect(r.state).toBe('selected');expect(p).toEqual(before);expect(buildProjectReport(p,'r50',{detail:'detailed',includeSources:true})).toEqual(r);
    const html=reportHtml(r);expect(html).toContain('Periksa biaya dan ruang bersama pembina');expect(html).toContain('bukan pemenang otomatis');expect(html).toContain('Relevansi');
    expect(html).toContain('J-RWH-2017');expect(html).not.toContain('J-TREES-2017');
    expect(reportPdfDefinition(r).info?.creationDate).toEqual(new Date(time));
  });
  it('renders unfinished truth and zero as different states',()=>{
    const empty=buildProjectReport(createProjectV2('empty','Lahan kosong',time),'rain-1');
    expect(empty.metrics).toBeNull();expect(reportHtml(empty)).toContain('Belum diketahui');expect(reportHtml(empty)).not.toContain('NaN');
    const p=saveRain(demoProject(true),'r50','Tanpa hujan',{text:'0',evidence:'ASSUMPTION',source:'Skenario tanpa hujan'},'');
    p.selectedPlan={definition:snapshotPlan(p,[],'no-treatment','Tanpa intervensi'),decisionNote:'Pembanding tanpa hujan',reviewedInputFingerprint:planningFingerprint(p)};
    const r=buildProjectReport(p,'r50');expect(r.metrics?.baseline).toBe(0);expect(reportHtml(r)).toContain('persentase penanganan tidak dihitung');expect(reportHtml(r)).not.toContain('NaN');
  });
  it('withholds stale selected results and handles UNKNOWN secondary capacities',()=>{
    const p=complete();p.parameters.find(v=>v.id===p.scenarios[0]!.rainfall.id)!.value=51;
    const stale=buildProjectReport(p,'r50');expect(stale.state).toBe('stale');expect(stale.metrics).toBeNull();expect(reportHtml(stale)).toContain('belum ditinjau ulang');
    const q=complete();for(const c of q.selectedPlan!.definition.components)delete c.performanceByScenario.r100;
    const unknown=buildProjectReport(q,'r100');expect(unknown.metrics).toBeNull();expect(reportHtml(unknown)).toContain('Belum dapat dinilai');
  });
  it('reflects different projects and escapes hostile user text in all HTML positions',()=>{
    const p=complete(),q=complete();q.name='<script>alert(1)</script>';q.selectedPlan!.decisionNote='<img src=x onerror=alert(2)>';
    q.scenarios[0]!.name='Hujan uji berbeda';const a=reportHtml(buildProjectReport(p,'r50')),b=reportHtml(buildProjectReport(q,'r50'));
    expect(a).not.toBe(b);expect(b).not.toContain('<script>');expect(b).not.toContain('<img src=x');expect(b).toContain('&lt;script&gt;');expect(b).toContain('Hujan uji berbeda');
  });
  it('omits source appendices and citations without changing numbers, conditions, UNKNOWN or user decisions',()=>{
    const p=complete(),full=buildProjectReport(p,'r50',{includeSources:true}),short=buildProjectReport(p,'r50',{includeSources:false});
    expect(short.metrics).toEqual(full.metrics);expect(short.state).toBe(full.state);expect(short.inputFingerprint).toBe(full.inputFingerprint);
    const html=reportHtml(short);expect(html).not.toContain('J-RWH-2017');expect(html).not.toContain('https://');expect(short.sections.some(s=>['sources','provenance','data-notes'].includes(s.id))).toBe(false);
    for(const phrase of ['Periksa biaya dan ruang bersama pembina','bukan pemenang otomatis','belum diketahui','syarat','Tidak memprediksi'])expect(html).toContain(phrase);
    expect(reportHtml(full)).toContain('J-RWH-2017');
  });
  it('adds a data-specific recommendation after the legacy PDF content without changing report section order',()=>{
    const p=complete(),r=buildProjectReport(p,'r50',{detail:'summary',includeSources:false});
    const sectionIds=r.sections.map(s=>s.id);
    expect(sectionIds).not.toContain('recommendation');
    expect(r.recommendation?.userReason).toBe('Periksa biaya dan ruang bersama pembina.');
    expect(r.recommendation?.strengths.join(' ')).toContain('m³');
    expect(r.recommendation?.strengths.join(' ')).toContain(p.selectedPlan!.definition.components.find(c=>c.enabled)!.name);
    const pdf=reportPdfDefinition(r),content=pdf.content as unknown as Array<Record<string,unknown>>;
    const recommendationPage=content.at(-1)!;
    expect(recommendationPage.pageBreak).toBe('before');
    const printed=JSON.stringify(content);
    expect(printed.indexOf('Kesimpulan proyek')).toBeLessThan(printed.indexOf('REKOMENDASI'));
    const q=complete();q.selectedPlan={definition:snapshotPlan(q,[],'baseline-choice','Tanpa intervensi'),decisionNote:'Saya memilih baseline untuk pembanding.',reviewedInputFingerprint:planningFingerprint(q)};
    expect(buildProjectReport(q,'r50').recommendation).not.toEqual(r.recommendation);
  });
});
