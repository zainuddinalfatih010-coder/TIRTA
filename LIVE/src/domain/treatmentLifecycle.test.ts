import { describe, it, expect } from 'vitest';
import { demoProject, setActiveComponents } from '../direction/productionBridge';
import { duplicateTreatment, overflowChoices, invalidatedDestinationLabels } from './treatmentLifecycle';
import { readInput, saveComponent } from './planningAuthoring';
import { evaluateEventPlan, snapshotPlan } from './planningEngine';
import { projectV2Schema } from './projectV2';

describe('independent treatment copies and current overflow destinations', () => {
  it('names only water relationships actually invalidated, without modifying either project', () => {
    const p = demoProject();
    p.science!.interventions.tank!.overflow = {kind:'intervention',id:'soak'};
    p.science!.connections.push({id:'current-z0',sourceZoneId:'z0',destination:{kind:'intervention',id:'soak'},via:'gutter-downpipe',origin:'user_supplied',source:'Synthetic route'});
    const unchanged = structuredClone(p);
    const next = setActiveComponents(p,['tank']);
    const checked = structuredClone(next);
    expect(invalidatedDestinationLabels(p,next)).toEqual(['Tangki atap (luapan)','Gedung belajar']);
    expect(invalidatedDestinationLabels(p,p)).toEqual([]);
    expect(invalidatedDestinationLabels(next,next)).toEqual([]);
    expect(p).toEqual(unchanged); expect(next).toEqual(checked);
  });
  it('removes an inactive destination from current routes without changing frozen history', () => {
    const p = demoProject();
    p.science!.interventions.tank!.overflow = { kind:'intervention', id:'soak' };
    const plan = snapshotPlan(p,['tank'],'saved','Saved');
    p.manualPlans.push(plan);
    const next = setActiveComponents(p,['tank']);
    expect(next.science!.interventions.tank!.overflow).toEqual({kind:'unknown'});
    expect(next.manualPlans[0]!.scientificEvidence!.tank!.overflow).toEqual({kind:'intervention',id:'soak'});
    expect(projectV2Schema.safeParse(next).success).toBe(true);
  });
  it('does not offer inactive, retired or self destinations', () => {
    const p=demoProject();
    p.components.find(c=>c.id==='soak')!.enabled=false;
    expect(overflowChoices(p,'tank',p.scenarios[0]!.id).map(c=>c.id)).toEqual(['garden']);
  });
  it('copies editable resources with new identities but requires new routing and capacity review', () => {
    const p=demoProject(), original=structuredClone(p), sid=p.scenarios[0]!.id;
    const copy=duplicateTreatment(p,'tank',sid);
    const c=copy.project.components.find(c=>c.id===copy.id)!;
    expect(c.id).not.toBe('tank');
    expect(c.totalCost.id).not.toBe(p.components.find(c=>c.id==='tank')!.totalCost.id);
    expect(readInput(copy.project,c.totalCost).text).toBe('3000000');
    expect(readInput(copy.project,c.occupiedArea).text).toBe('2');
    expect(c.treatment!.catchmentReviewed).toBe(null);
    expect(copy.project.science!.interventions[c.id]!.overflow.kind).toBe('unknown');
    expect(evaluateEventPlan(copy.project,snapshotPlan(copy.project,[c.id],'new','new'),sid).ok).toBe(false);
    expect(p).toEqual(original);
    const changed=saveComponent(copy.project,{id:c.id,name:'Second tank',family:'storage',targets:c.targets,siteId:c.installationSiteId!,connection:'',applicability:'',cost:{text:'8000000',source:'My quote',evidence:'ASSUMPTION'},area:readInput(copy.project,c.occupiedArea),capacity:{text:'',source:'',evidence:'UNKNOWN'},scenarioId:sid,reuse:null});
    expect(readInput(changed,changed.components.find(x=>x.id==='tank')!.totalCost).text).toBe('3000000');
    expect(projectV2Schema.safeParse(changed).success).toBe(true);
  });
  it('requires an explicit new zone for conversion duplication and avoids identity collisions',()=>{
    const p=demoProject(),sid=p.scenarios[0]!.id;
    expect(()=>duplicateTreatment(p,'porous',sid)).toThrow(/konversi zona/i);
    const first=duplicateTreatment(p,'tank',sid), second=duplicateTreatment(first.project,'tank',sid);
    expect(first.id).not.toBe(second.id);
  });
});
