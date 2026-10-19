import {describe,it,expect} from 'vitest';
import {currentDemoProject} from '../direction/productionBridge';
import {optimize,planningFingerprint} from '../domain/planningEngine';
import {guidedCandidates,prepareGuidedDraft,recommendationMethods} from './recommendationGuide';

describe('grounded recommendation guide',()=>{
 it('keeps Biopori in current alternatives and never exposes permeable conversion as a current recommendation method',()=>{
  const p=currentDemoProject(true),before=structuredClone(p),search=optimize(p,'r50');expect(search.ok).toBe(true);if(!search.ok)return;
  expect('permeable' in recommendationMethods).toBe(false);
  expect('biopori' in recommendationMethods).toBe(true);
  expect(search.value.alternatives.some(a=>a.plan.components.some(c=>c.enabled&&c.family==='permeable'))).toBe(false);
  const biopori=search.value.alternatives.filter(a=>a.plan.components.some(c=>c.enabled&&c.family==='infiltration'&&c.infiltrationType==='biopori'));expect(biopori.length).toBeGreaterThan(0);
  expect(guidedCandidates(p,biopori,'r50','residual').length).toBeGreaterThan(0);
  for(const priority of ['residual','cost','area'] as const){const result=guidedCandidates(p,search.value.alternatives,'r50',priority);if(result.length)expect(new Set(result.map(a=>a.balance[priority])).size).toBe(1);}
  expect(p).toEqual(before);
 });
 it('prepares Biopori on any non-roof installation surface, preserves UNKNOWN engineering, and rejects roof placement',()=>{
  const p=currentDemoProject(true),source=p.zones.find(z=>z.surface==='roof')!;
  const before=structuredClone(p);
  for(const site of p.zones.filter(z=>z.surface!=='roof')){
   const request={fingerprint:planningFingerprint(p),sourceId:source.id,siteId:site.id,method:'biopori' as const};
   const next=prepareGuidedDraft(p,'r50',request),c=next.project.components.find(c=>c.id===next.id)!;
   expect(c.family==='infiltration'&&c.infiltrationType).toBe('biopori');expect(c.targets).toEqual([source.id]);expect(c.treatment?.installationZoneId).toBe(site.id);expect(next.project.parameters.find(v=>v.id===c.totalCost.id)?.value).toBeNull();expect(next.project.science?.interventions[c.id]?.soilInfiltration.value).toBeNull();expect(next.project.selectedPlan).toEqual(p.selectedPlan);
  }
  const request={fingerprint:planningFingerprint(p),sourceId:source.id,siteId:source.id,method:'biopori' as const};
  expect(()=>prepareGuidedDraft(p,'r50',request)).toThrow('Atap');expect(()=>prepareGuidedDraft(p,'r50',{...request,fingerprint:'old'})).toThrow('Data berubah');expect(()=>prepareGuidedDraft(p,'r50',{...request,sourceId:'deleted'})).toThrow('zona sumber');expect(p).toEqual(before);
 });
});
