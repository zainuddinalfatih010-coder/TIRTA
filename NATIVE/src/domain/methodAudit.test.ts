import { describe, it, expect } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { assessIntervention } from './feasibility';
import { allocationSequence, evaluatePlan, snapshotPlan, optimize } from './planningEngine';
import { productionBaseline } from './productionBaseline';
import { scientificSummary } from './scientificExport';
import { methodNotes } from './methodTraceability';
import { scientificClaims } from './evidenceRegistry';

describe('method applicability and independently calculated reference cases', () => {
  it.each(['roof','soil','vegetation','porous',null] as const)('does not convert %s as pavement, even when complete evidence is supplied', surface => {
    const p=demoProject(), c=p.components.find(c=>c.id==='porous')!;
    if(surface === null) p.zones.find(z=>z.id===c.targets[0])!.surface=null;
    else c.targets=[p.zones.find(z=>z.surface===surface)!.id];
    expect(assessIntervention(p,c,'r50').reasons.some(r=>r.ruleId==='CONVERSION')).toBe(true);
    expect(evaluatePlan(p,snapshotPlan(p,[c.id],'test','Invalid conversion'),'r50').ok).toBe(false);
    const result=optimize(p,'r50'); if(surface !== null) expect(result.ok,JSON.stringify(result)).toBe(true);
    if(result.ok) expect(result.value.alternatives.every(a=>!a.plan.components.some(x=>x.id===c.id))).toBe(true);
  });
  it('preserves the 200 m² five-surface manual volume and all-family conservation fixture', () => {
    const p=demoProject(), b=productionBaseline(p,'r50'); expect(b.ok).toBe(true);
    if(!b.ok) return;
    // (60*.85 + 68*.9 + 30*.2 + 30*.12 + 12*.3)*.05 = 6.27.
    expect(b.value.rainfallM3).toBeCloseTo(10,12); expect(b.value.runoffM3).toBeCloseTo(6.27,12);
    const r=evaluatePlan(p,snapshotPlan(p,p.components.map(c=>c.id),'all','All families'),'r50');
    expect(r.ok,JSON.stringify(r)).toBe(true); if(!r.ok)return;
    expect(r.value.stored).toBeCloseTo(2.55,12);expect(r.value.infiltrated).toBeCloseTo(3.36,12);
    expect(r.value.residual).toBeCloseTo(.36,12);expect(r.value.reused).toBe(0);
    expect(r.value.components.find(c=>c.id==='porous')!.infiltrated).toBeCloseTo(3.06*8/68,12);
    expect(r.value.stored+r.value.reused+r.value.infiltrated+r.value.residual).toBeCloseTo(6.27,12);
  });
  it('exposes the exact executed order including local conversion first, regardless of declared position',()=>{
    const p=demoProject(), plan=snapshotPlan(p,['garden','porous','tank'],'order','Order');
    plan.priority=['tank','garden','porous'];const r=evaluatePlan(p,plan,'r50');expect(r.ok).toBe(true);
    if(r.ok) expect(r.value.components.map(c=>c.id)).toEqual(allocationSequence(plan).map(c=>c.id));
    expect(allocationSequence(plan).map(c=>c.id)).toEqual(['porous','tank','garden']);
    const report=scientificSummary(p,plan,'r50').join('\n');expect(report).toContain('1. Permukaan berpori: Halaman kegiatan');expect(report).toContain('BUKAN SIMULASI HIDRAULIK');
  });
  it('makes shared-source priority effects reproducible without creating or duplicating water',()=>{
    const p=demoProject(), soak=p.components.find(c=>c.id==='soak')!;soak.targets=['z0'];
    const link=p.science!.connections.find(c=>c.candidateId==='soak')!;link.sourceZoneId='z0';
    const plan=snapshotPlan(p,['tank','soak'],'shared','Shared source');
    const a=evaluatePlan(p,plan,'r50');plan.priority.reverse();const b=evaluatePlan(p,plan,'r50');
    expect(a.ok,JSON.stringify(a)).toBe(true);expect(b.ok,JSON.stringify(b)).toBe(true);if(!a.ok||!b.ok)return;
    expect(a.value.stored).toBeCloseTo(2.55,12);expect(a.value.infiltrated).toBe(0);
    expect(b.value.stored).toBeCloseTo(.05,12);expect(b.value.infiltrated).toBeCloseTo(2.5,12);
    expect(a.value.residual).toBeCloseTo(b.value.residual,12);
  });
  it.each([0,1,60,100])('scales baseline transparently for rainfall %s mm, without hiding zero',rain=>{
    const p=demoProject(), s=p.scenarios.find(s=>s.id==='r50')!;
    p.parameters.find(v=>v.id===s.rainfall.id)!.value=rain;
    const b=productionBaseline(p,'r50');expect(b.ok).toBe(true);if(!b.ok)return;
    expect(b.value.rainfallM3).toBeCloseTo(.2*rain,12);expect(b.value.runoffM3).toBeCloseTo(.1254*rain,12);
  });
  it('traceability notes cite actual claims and clearly distinguish product rules',()=>{
    expect(new Set(methodNotes.map(m=>m.id)).size).toBe(methodNotes.length);
    for(const m of methodNotes){expect([m.summary,m.inputs,m.method,m.interpretation,m.limit].every(s=>s.trim().length>10)).toBe(true);for(const id of m.claimIds)expect(scientificClaims.some(c=>c.id===id)).toBe(true);}
    expect(methodNotes.find(m=>m.id==='parcel')!.method).toContain('batas produk');
    expect(methodNotes.find(m=>m.id==='surface')!.method).toContain('belum merupakan model terlatih');
  });
});
