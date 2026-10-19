import {describe,it,expect} from 'vitest';
import {currentDemoProject,alternativeSearch} from '../direction/productionBridge';
import {snapshotPlan,evaluatePlan} from './planningEngine';
import {addTreatment} from './treatmentDesign';
import {saveComponent} from './planningAuthoring';

const known=(value:number)=>({text:String(value),evidence:'ASSUMPTION' as const,source:'Legacy compatibility fixture'});

describe('current intervention policy versus historical records',()=>{
  it('keeps Biopori current, removes permeable conversion from current search, and preserves a frozen legacy plan',()=>{
    const base=currentDemoProject();
    const paved=base.zones.find(z=>z.surface==='paved')!;
    const added=addTreatment(base,'permeable','r50',paved.id);
    const legacy=saveComponent(added.project,{id:added.id,name:'Permukaan berpori lama',family:'permeable',targets:[paved.id],siteId:'site-main',connection:'Catatan historis',applicability:'Catatan historis',cost:known(2_000_000),area:known(4),scenarioId:'r50',capacity:known(1),reuse:null,treatment:{installationZoneId:paved.id,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:null}});
    const historical=snapshotPlan(legacy,[added.id],'old-porous','Historical permeable option');
    legacy.manualPlans.push(historical);
    const before=structuredClone(legacy);
    const rows=alternativeSearch(legacy,'r50').rows;
    expect(rows.some(r=>r.plan.components.some(c=>c.enabled&&c.family==='permeable'))).toBe(false);
    expect(rows.some(r=>r.plan.components.some(c=>c.enabled&&c.family==='infiltration'&&c.infiltrationType==='biopori'))).toBe(true);
    expect(legacy).toEqual(before);
    expect(evaluatePlan(legacy,historical,'r50').ok).toBe(true);
  });
});
