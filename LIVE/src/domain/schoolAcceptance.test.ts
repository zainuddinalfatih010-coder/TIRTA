import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { partialActualPilot, hypotheticalSchool } from '../test/schoolCampaignFixtures';
import { projectV2Schema } from './projectV2';
import { siteGuidance } from './siteGuidance';
import { evaluatePlan, snapshotPlan } from './planningEngine';
import { productionBaseline } from './productionBaseline';
import { projectBackup } from '../persistence/portable';
import { alternativeSearch } from '../direction/productionBridge';

const folder = 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/presentation';
it('the partial actual pilot stops for absent field data rather than claiming a measured result', () => {
  const p = partialActualPilot();
  expect(projectV2Schema.safeParse(p).success).toBe(true);
  expect(productionBaseline(p, p.scenarios[0]!.id).ok).toBe(false);
  expect(siteGuidance(p, p.scenarios[0]!.id).every(g=>g.status === 'needs-data' || g.status === 'retired')).toBe(true);
  expect(p.parameters.filter(v=>v.unit==='ratio'||v.unit==='m2').every(v=>v.value===null)).toBe(true);
  expect(p.parameters.filter(v=>v.unit==='mm').every(v=>v.evidence==='ASSUMPTION')).toBe(true);
  mkdirSync(folder,{recursive:true}); writeFileSync(folder+'/actual-pilot-partial.tirta.json', projectBackup(p));
  writeFileSync(folder+'/actual-pilot-evidence.json', JSON.stringify({evidence:'owner qualitative feedback only', porousPilotChoice:'proposal-core; field performance unresolved', causalExplanation:null, surveyedParcel:null, measuredRain:null, soilEvidence:null, groundwaterReview:null, installedEventCapacity:null, beforeAfterOutcome:null, warning:'Proposal planning examples are not surveyed pilot data.'},null,2));
});
it('a synthetic school models declared garden capacity with pending soil verification', () => {
  const p = hypotheticalSchool(), sid = 'r50';
  const tank = evaluatePlan(p,snapshotPlan(p,['tank'],'tank-school','Tank under declared assumptions'),sid);
  expect(tank.ok).toBe(true); if(tank.ok){expect(tank.value.baseline).toBeCloseTo(6.27);expect(tank.value.stored).toBeCloseTo(2.55);expect(tank.value.residual).toBeCloseTo(3.72);}
  expect(evaluatePlan(p,snapshotPlan(p,['tank','garden'],'both','Unreviewed garden'),sid).ok).toBe(true);
  const search = alternativeSearch(p,sid);
  expect(search.rows.some(r=>r.optionIds.includes('tank'))).toBe(true);
  expect(search.rows.some(r=>r.optionIds.includes('garden'))).toBe(true);
  expect(siteGuidance(p,sid,{componentId:'garden'}).find(g=>g.id==='rain-garden')!.conditions.join(' ')).toContain('infiltrasi tanah');
  // The portable representation retains the explicit inputs; the browser test also imports it.
  const restored = projectV2Schema.parse(JSON.parse(projectBackup(p)).project);
  expect(productionBaseline(restored,sid)).toEqual(productionBaseline(p,sid));
  mkdirSync(folder,{recursive:true}); writeFileSync(folder+'/hypothetical-school.tirta.json',projectBackup(p));
});
