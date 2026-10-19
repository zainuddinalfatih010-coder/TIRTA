import {describe,it,expect} from 'vitest';
import {demoProject,setActiveComponents} from '../direction/productionBridge';
import {exploreTreatment} from './treatmentEditing';
import {productState,treatmentRequirements} from './productState';
import {fieldDecisionReadiness} from './fieldDecisionReadiness';
import {planningFingerprint,snapshotPlan} from './planningEngine';

describe('complete requirements without changing canonical eligibility',()=>{
  it('shared-source alternative labels are human and represent the actual supported mode',()=>{const p=setActiveComponents(demoProject(),['tank','soak']);const c=p.components.find(c=>c.id==='tank')!;p.components.find(c=>c.id==='soak')!.targets=[...c.targets];c.treatment={installationZoneId:null,sharedSourceMode:'alternative',allocationNote:'',catchmentReviewed:null};const row=treatmentRequirements(p,c,'r50').flatMap(s=>s.rows).find(r=>r.field==='sharedSourceMode')!;expect(row.value).toBe('Alternatif terpisah');expect(row.status).toBe('known');});
  it('deleted overflow and damaged installation are visible requirements, without exposing state enums',()=>{
    const p=setActiveComponents(demoProject(),['tank']);const c=p.components.find(c=>c.id==='tank')!;const e=p.science!.interventions[c.id]!;
    e.overflow={kind:'intervention',id:'deleted-destination'};e.condition='damaged';
    const rows=treatmentRequirements(p,c,'r50').flatMap(s=>s.rows);
    expect(rows.find(r=>r.field==='connection')!.status).toBe('invalid');expect(rows.find(r=>r.field==='condition')!.status).toBe('invalid');
  });

  for(const [family,bio] of [['storage',false],['infiltration',false],['rain-garden',false],['infiltration',true]] as const) it(`${family}/${bio}: exposes all requirements before baseline or first connection is complete`,()=>{
    const original=setActiveComponents(demoProject(),[]),before=structuredClone(original);
    const session=exploreTreatment(original,family,'r50',undefined,bio);
    const p=session.project;p.parameters.find(v=>v.id===p.scenarios[0]!.rainfall.id)!.value=null;
    const c=p.components.find(c=>c.id===session.id)!;
    const sections=treatmentRequirements(p,c,'r50');
    expect(sections.map(s=>s.id)).toEqual(['connection','capacity','site','resources']);
    const rows=sections.flatMap(s=>s.rows);for(const field of ['source','via','capacity','capacityBasis','cost','area','budget','land'])expect(rows.some(r=>r.field===field)).toBe(true);
    if(family!=='storage')for(const field of ['soil','groundwater'])expect(rows.find(r=>r.field===field)?.status).toBe('missing');
    expect(rows.every(r=>r.why.length>20)).toBe(true);
    expect(productState(p,'r50',c.id).decision).toEqual(fieldDecisionReadiness(p,'r50'));
    expect(original).toEqual(before);
  });
  it('does not turn optional field verification into a calculation blocker or certainty',()=>{
    const p=setActiveComponents(demoProject(),['tank']);const s=productState(p,'r50');
    expect(s.decision.activePackage.calculationReady).toBe(true);expect(s.decision.activePackage.comparisonReady).toBe(true);
    expect(s.treatments.find(c=>c.id==='tank')!.siteVerificationReady).toBe(false);expect(s.treatments.find(c=>c.id==='tank')!.sections.flatMap(group=>group.rows).some(row=>row.field==='standard')).toBe(false);
    for(const field of ['connection','condition','maintenance','field','operation']) {
      const row=s.treatments.find(c=>c.id==='tank')!.sections.flatMap(group=>group.rows).find(row=>row.field===field)!;
      expect((row as typeof row & {required?:boolean}).required).toBe(false);
    }
  });
  it('zero cost is known; unknown cost is partial, independently from water calculation',()=>{
    const p=setActiveComponents(demoProject(),['tank','soak']);const tank=p.components.find(c=>c.id==='tank')!;p.parameters.find(v=>v.id===tank.totalCost.id)!.value=0;
    expect(productState(p,'r50').resources!.cost.total).toBe(2500000);
    const soak=p.components.find(c=>c.id==='soak')!;const v=p.parameters.find(v=>v.id===soak.totalCost.id)!;v.value=null;v.evidence='UNKNOWN';v.source='';soak.totalCost.evidence='UNKNOWN';
    const state=productState(p,'r50');expect(state.resources!.cost).toEqual({known:0,unknown:1,total:null});expect(state.decision.activePackage.calculationReady).toBe(true);expect(state.decision.activePackage.comparisonReady).toBe(false);
  });
  it('selected baseline remains current during exploration; upstream edits explicitly make it stale',()=>{
    const p=setActiveComponents(demoProject(),[]);p.selectedPlan={definition:snapshotPlan(p,[],'baseline','Tanpa intervensi'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan saya'};
    exploreTreatment(p,'infiltration','r50',undefined,true);expect(productState(p,'r50').selected).toBe('current');
    p.parameters.find(v=>v.id===p.constraints.budget.id)!.value=10;expect(productState(p,'r50').selected).toBe('stale');
  });
  it('known area that exceeds a resource limit stays known-looking but exposes the canonical incompatibility reason',()=>{
    const p=setActiveComponents(demoProject(),['tank']);const c=p.components.find(c=>c.id==='tank')!;const area=p.parameters.find(v=>v.id===c.occupiedArea.id)!;
    area.value=999;area.evidence='ASSUMPTION';area.source='Asumsi pribadi';c.occupiedArea.evidence='ASSUMPTION';
    const row=treatmentRequirements(p,c,'r50').flatMap(s=>s.rows).find(r=>r.field==='area')!;
    expect(row.value).toContain('999');expect(row.status).toBe('invalid');expect(row.message).toMatch(/melebihi|kurangi|lokasi/i);
    expect(fieldDecisionReadiness(p,'r50').treatments.find(item=>item.id==='tank')!.comparisonReady).toBe(false);
  });
  it('wrong biopori installation and incompatible groundwater stay explicit, never a green progress counter',()=>{
    const edit=exploreTreatment(demoProject(),'infiltration','r50',undefined,true),p=edit.project,c=p.components.find(c=>c.id===edit.id)!;c.treatment!.installationZoneId='z0';
    let rows=treatmentRequirements(p,c,'r50').flatMap(s=>s.rows);expect(rows.find(r=>r.field==='installation')!.status).toBe('invalid');
    p.science!.interventions[c.id]!.groundwaterAssessment='unsuitable';p.science!.interventions[c.id]!.groundwaterBasis='Pengamatan uji';rows=treatmentRequirements(p,c,'r50').flatMap(s=>s.rows);expect(rows.find(r=>r.field==='groundwater')!.status).toBe('invalid');
  });
});

