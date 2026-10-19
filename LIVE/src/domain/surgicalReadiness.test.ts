import {describe,it,expect} from 'vitest';
import {demoProject,setActiveComponents,blankSnapshot,alternativeSearch} from '../direction/productionBridge';
import {createProjectV2,projectV2Schema,type ProjectV2} from './projectV2';
import {evaluateEventPlan,evaluatePlan,snapshotPlan,optimize,planningFingerprint,legacyPlanningFingerprint,verificationFingerprint} from './planningEngine';
import {fieldDecisionReadiness} from './fieldDecisionReadiness';
import {assessIntervention} from './feasibility';
import {unknownNumber,emptySurfaceContext} from './scientificContract';
import {treatmentRequirements} from './productState';
import {questionQueue} from './guidedIntake';
import {migrateProject} from './migration';
import {saveComponent,readInput} from './planningAuthoring';
import {reviewLegacySite} from './interventionSuitability';
import {projectBackup} from '../persistence/portable';
import {buildProjectReport} from '../report/projectReport';
import {interventionReview} from './interventionReview';
const garden=()=>{
  const p=setActiveComponents(demoProject(),['garden']),e=p.science!.interventions.garden!;
  e.soilInfiltration=unknownNumber('mm/h');e.groundwaterAssessment='unknown';e.groundwaterBasis='';
  return p;
};
const plan=(p:ProjectV2,ids=['garden'])=>snapshotPlan(p,ids,'regression-choice','Pilihan pengguna');
const select=(p:ProjectV2)=>{p.selectedPlan={definition:plan(p),decisionNote:'Pilihan saya',reviewedInputFingerprint:planningFingerprint(p)};return p;};
describe('surgical three-layer contract',()=>{
  it('A: declared event capacity produces conserved water and comparable trade-offs with implementation pending',()=>{
    const p=garden(),before=structuredClone(p),b=evaluateEventPlan(p,plan(p),'r50');
    expect(b.ok).toBe(true);if(!b.ok)throw new Error(JSON.stringify(b));
    expect(b.value.infiltrated).toBeGreaterThan(0);expect(b.value.residual+b.value.infiltrated+b.value.stored+b.value.reused).toBeCloseTo(b.value.baseline,12);
    const r=fieldDecisionReadiness(p,'r50').activePackage;
    expect(r).toMatchObject({calculationReady:true,comparisonReady:true,verificationReady:false});
    expect(r.verificationChecks.map(f=>f.ruleId)).toEqual(expect.arrayContaining(['SOIL','GROUNDWATER']));
    expect(alternativeSearch(p,'r50').rows.some(a=>a.optionIds.includes('garden'))).toBe(true);
    expect(p).toEqual(before);expect(evaluateEventPlan(p,plan(p),'r50')).toEqual(b);
    const report=buildProjectReport(select(p),'r50');expect(report.metrics?.infiltrated).toBeGreaterThan(0);expect(JSON.stringify(report.sections)).toContain('air tanah');
  });
  it('B: absent capacity never becomes zero and cannot be skipped as a water prerequisite',()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!;
    const perf=c.performanceByScenario.r50!;if(!('infiltrationCapacity' in perf))throw new Error('fixture');
    const v=p.parameters.find(v=>v.id===perf.infiltrationCapacity.id)!;Object.assign(v,{value:null,evidence:'UNKNOWN',source:''});perf.infiltrationCapacity.evidence='UNKNOWN';
    expect(evaluateEventPlan(p,plan(p),'r50').ok).toBe(false);
    expect(questionQueue(treatmentRequirements(p,c,'r50'),{capacity:'unknown'})).toContain('capacity');
    expect(fieldDecisionReadiness(p,'r50').activePackage.calculationActions.some(a=>a.field==='capacity')).toBe(true);expect(v.value).toBeNull();
  });
  for(const bad of ['zero-soil','groundwater','clogged','standard'] as const)it(`C: known bad ${bad} still rejects benefit`,()=>{
    const p=garden(),e=p.science!.interventions.garden!;
    if(bad==='zero-soil')e.soilInfiltration={value:0,unit:'mm/h',origin:'user_supplied',source:'Declared zero infiltration',method:'',date:''};
    if(bad==='groundwater'){e.groundwaterAssessment='unsuitable';e.groundwaterBasis='Explicit adverse assessment';}
    if(bad==='clogged')e.condition='clogged';if(bad==='standard'){e.localStandardReview='failed';e.localStandardBasis='Known adverse requirement';}
    expect(evaluateEventPlan(p,plan(p),'r50').ok).toBe(false);expect(fieldDecisionReadiness(p,'r50').activePackage.calculationActions.some(a=>a.severity==='incompatible')).toBe(true);
  });
  it('D: unknown money has no water effect, no displayed zero and no optimizer eligibility',()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!,v=p.parameters.find(v=>v.id===c.totalCost.id)!;
    Object.assign(v,{value:null,evidence:'UNKNOWN',source:''});c.totalCost.evidence='UNKNOWN';
    const b=evaluateEventPlan(p,plan(p),'r50');expect(b.ok).toBe(true);if(b.ok)expect(b.value).not.toHaveProperty('cost');
    expect(evaluatePlan(p,plan(p),'r50').ok).toBe(false);
    expect(fieldDecisionReadiness(p,'r50').activePackage).toMatchObject({calculationReady:true,comparisonReady:false});
    expect(alternativeSearch(p,'r50').rows.every(a=>!a.optionIds.includes('garden'))).toBe(true);
  });
  it('E: one active rain suffices; explicitly required unknown rain still gates eligibility',()=>{
    const p=garden();p.scenarios=p.scenarios.filter(s=>s.id==='r50');p.constraints.requiredScenarioIds=[];
    expect(optimize(p,'r50').ok).toBe(true);expect(fieldDecisionReadiness(p,'r50').activePackage.comparisonReady).toBe(true);
    const q=garden();q.constraints.requiredScenarioIds=['r100'];const s=q.scenarios.find(s=>s.id==='r100')!,v=q.parameters.find(v=>v.id===s.rainfall.id)!;Object.assign(v,{value:null,evidence:'UNKNOWN',source:''});s.rainfall.evidence='UNKNOWN';
    expect(fieldDecisionReadiness(q,'r50').activePackage.comparisonReady).toBe(false);
    q.constraints.requiredScenarioIds=[];expect(fieldDecisionReadiness(q,'r50').activePackage.comparisonReady).toBe(true);
  });
  it('F: factory and blank snapshot have exactly two explicit test scenarios; imports keep their own set',()=>{
    for(const p of [createProjectV2('factory','Test','2026-10-11T00:00:00.000Z'),blankSnapshot().project]){
      expect(p.scenarios).toHaveLength(2);expect(p.scenarios.map(s=>p.parameters.find(v=>v.id===s.rainfall.id)!.value)).toEqual([50,100]);
      expect(p.scenarios.every(s=>p.parameters.find(v=>v.id===s.rainfall.id)!.evidence==='ASSUMPTION')).toBe(true);
    }
    const p=garden();p.scenarios=p.scenarios.filter(s=>s.id==='r50');p.constraints.requiredScenarioIds=[];
    expect(migrateProject(JSON.parse(projectBackup(p)).project,'').scenarios).toEqual(p.scenarios);
  });
  it('G: naming, notes, placement and successful verification edits preserve decision and update verification state',()=>{
    const p=select(garden()),before=planningFingerprint(p),verification=verificationFingerprint(p);
    p.name='Nama proyek baru';p.components.find(c=>c.id==='garden')!.name='Nama intervensi';p.components.find(c=>c.id==='garden')!.placement={point:{x:5,y:5},footprint:null,context:'schematic'};
    const e=p.science!.interventions.garden!;e.maintenance='Pemeriksaan berkala';e.verificationSource='Catatan tinjauan';e.fieldVerified=true;e.groundwaterAssessment='suitable';e.groundwaterBasis='Tinjauan selesai';e.localStandardBasis='Dokumentasi diperbarui';
    expect(planningFingerprint(p)).toBe(before);expect(verificationFingerprint(p)).not.toBe(verification);expect(fieldDecisionReadiness(p,'r50').selected.status).toBe('current');expect(buildProjectReport(p,'r50').state).toBe('selected');
    e.groundwaterAssessment='unsuitable';expect(planningFingerprint(p)).not.toBe(before);expect(evaluateEventPlan(p,p.selectedPlan!.definition,'r50').ok).toBe(false);
  });
  for(const field of ['rain','capacity','budget'] as const)it(`H: ${field} change invalidates selection while frozen history remains intact`,()=>{
    const p=select(garden()),frozen=structuredClone(p.selectedPlan!.definition),c=p.components.find(c=>c.id==='garden')!,perf=c.performanceByScenario.r50!;
    if(!('infiltrationCapacity' in perf))throw new Error('fixture');
    const id=field==='rain'?p.scenarios[0]!.rainfall.id:field==='budget'?p.constraints.budget.id:perf.infiltrationCapacity.id;
    p.parameters.find(v=>v.id===id)!.value!+=1;
    expect(fieldDecisionReadiness(p,'r50').selected.status).toBe('stale');expect(p.selectedPlan!.definition).toEqual(frozen);
  });
  for(const state of ['yes','no','unknown'] as const)it(`I: legacy ${state} remains importable, inspectable and correctly projected`,()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!;c.siteAssessment={connection:'unknown',infiltration:state,plantingSpace:'unknown',surfaceChange:'unknown',source:state==='unknown'?'':'Original legacy site declaration'};
    const q=migrateProject(JSON.parse(projectBackup(p)).project,'');expect(q.components.find(item=>item.id===c.id)!.siteAssessment).toEqual(c.siteAssessment);
    expect(evaluateEventPlan(q,plan(q),'r50').ok).toBe(state!=='no');
    if(state==='no'){
      expect(assessIntervention(q,q.components.find(c=>c.id==='garden')!,'r50').reasons.some(f=>f.field==='soil'&&f.message.includes('Original legacy'))).toBe(true);
      expect(reviewLegacySite(q,structuredClone(q),'garden')).toEqual(q);
      const edited=structuredClone(q);edited.science!.interventions.garden!.soilInfiltration={value:7,unit:'mm/h',origin:'user_supplied',source:'Explicit corrected site evidence',method:'',date:''};
      const corrected=reviewLegacySite(q,edited,'garden');expect(corrected.components.find(c=>c.id==='garden')!.siteAssessment!.source).toContain('infiltration=no');expect(evaluateEventPlan(corrected,plan(corrected),'r50').ok).toBe(true);
      expect(q.components.find(c=>c.id==='garden')!.siteAssessment!.infiltration).toBe('no');
    }
  });
  it('I: a full legacy source remains verbatim without preventing an explicit correction',()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!;
    c.siteAssessment={connection:'unknown',infiltration:'no',plantingSpace:'unknown',surfaceChange:'unknown',source:'x'.repeat(2000)};
    const edited=structuredClone(p);edited.science!.interventions.garden!.soilInfiltration={value:7,unit:'mm/h',origin:'user_supplied',source:'Explicit corrected site evidence',method:'',date:''};
    const corrected=reviewLegacySite(p,edited,'garden');
    expect(corrected.components.find(v=>v.id===c.id)!.siteAssessment).toMatchObject({infiltration:'yes',source:c.siteAssessment.source});
    expect(projectV2Schema.safeParse(corrected).success).toBe(true);expect(evaluateEventPlan(corrected,plan(corrected),'r50').ok).toBe(true);
    expect(p.components.find(v=>v.id===c.id)!.siteAssessment!.infiltration).toBe('no');
  });
  it('I: authoring an absent installation zone as null does not erase legacy evidence',()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!;
    delete c.treatment;c.siteAssessment={connection:'unknown',infiltration:'no',plantingSpace:'unknown',surfaceChange:'unknown',source:'Original site finding'};
    const perf=c.performanceByScenario.r50!;if(!('infiltrationCapacity' in perf))throw new Error('fixture');
    const edited=saveComponent(p,{id:c.id,name:c.name,family:c.family,targets:c.targets,siteId:c.installationSiteId??'',connection:c.connectionNote,applicability:c.applicability,cost:readInput(p,c.totalCost),area:readInput(p,c.occupiedArea),capacity:readInput(p,perf.infiltrationCapacity),scenarioId:'r50',reuse:null,treatment:{installationZoneId:null,sharedSourceMode:'unresolved',allocationNote:''}});
    expect(edited.components.find(v=>v.id===c.id)!.siteAssessment).toEqual(c.siteAssessment);
    expect(edited.science!.interventions.garden!.soilInfiltration).toEqual(p.science!.interventions.garden!.soilInfiltration);
    expect(evaluateEventPlan(edited,plan(edited),'r50').ok).toBe(false);
  });
  it('I: only previously current legacy decision identities upgrade, stale history and evidence remain unchanged',()=>{
    const p=select(garden());p.selectedPlan!.reviewedInputFingerprint=legacyPlanningFingerprint(p);
    const history=structuredClone(p.selectedPlan!.definition),evidence=structuredClone(p.science);
    const current=migrateProject(p,'');expect(current.selectedPlan!.reviewedInputFingerprint).toBe(planningFingerprint(current));expect(current.selectedPlan!.definition).toEqual(history);expect(current.science).toEqual(evidence);
    p.selectedPlan!.reviewedInputFingerprint='event-ledger-v1:obsolete';expect(migrateProject(p,'').selectedPlan!.reviewedInputFingerprint).toBe('event-ledger-v1:obsolete');
    expect(()=>migrateProject({...p,schemaVersion:999},'')).toThrow();expect(projectV2Schema.safeParse({...p,unknownProperty:true}).success).toBe(false);
  });
  it('J: shared source ledger uses explicit priority, needs no prose, and never double counts',()=>{
    const p=setActiveComponents(demoProject(),['tank','garden']),cs=p.components.filter(c=>c.enabled);
    for(const c of cs){c.targets=['z0'];c.connectionNote='';c.treatment={installationZoneId:null,sharedSourceMode:'ledger',allocationNote:'',catchmentReviewed:null};}
    p.science!.connections=[];
    const b=evaluateEventPlan(p,plan(p,['tank','garden']),'r50');expect(b.ok).toBe(true);if(!b.ok)throw new Error(JSON.stringify(b));
    expect(b.value.components.reduce((n,c)=>n+(c.byZone.z0??0),0)).toBeLessThanOrEqual(2.55);
    expect(b.value.stored+b.value.reused+b.value.infiltrated+b.value.residual).toBeCloseTo(b.value.baseline,12);
    cs[0]!.treatment!.sharedSourceMode='parallel';expect(evaluateEventPlan(p,plan(p,['tank','garden']),'r50').ok).toBe(false);
  });
  it('capacity review has one authority; retired rainfall/applicability bookkeeping cannot create artificial stale state',()=>{
    const p=garden(),before=planningFingerprint(p),c=p.components.find(c=>c.id==='garden')!;
    c.performanceByScenario.r50!.reviewedRainfallMm=999;c.performanceByScenario.r50!.applicability='';c.applicability='';
    expect(planningFingerprint(p)).toBe(before);expect(interventionReview(p,[c],'r50').filter(n=>n.kind==='rain')).toEqual([]);expect(evaluateEventPlan(p,plan(p),'r50').ok).toBe(true);
    p.parameters.find(v=>v.id===p.scenarios[0]!.rainfall.id)!.value=60;expect(interventionReview(p,[c],'r50').some(n=>n.kind==='rain')).toBe(true);
  });
  it('changed referenced soil cannot hide a newly declared zero infiltration at the same location',()=>{
    const p=garden(),c=p.components.find(c=>c.id==='garden')!,ctx=emptySurfaceContext();c.treatment={installationZoneId:'z2',sharedSourceMode:'ledger',allocationNote:'',catchmentReviewed:null};
    ctx.soil.infiltration={value:7,unit:'mm/h',origin:'user_supplied',source:'Explicit site observation',method:'',date:''};p.science!.surfaces.z2=ctx;
    p.science!.interventions.garden!.soilReference={zoneId:'z2',confirmation:'Same installation location',observation:structuredClone(ctx.soil.infiltration)};
    ctx.soil.infiltration.value=0;expect(evaluateEventPlan(p,plan(p),'r50').ok).toBe(false);
  });
});
