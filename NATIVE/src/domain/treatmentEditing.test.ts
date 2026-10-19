import {describe,it,expect} from 'vitest';
import {demoProject,setActiveComponents} from '../direction/productionBridge';
import {exploreTreatment,editTreatment,commitTreatmentEdit,rebaseTreatmentEditLimits,deleteTreatment,packageResources} from './treatmentEditing';
import {planningFingerprint,snapshotPlan} from './planningEngine';
import {projectV2Schema} from './projectV2';
import {savePlanningLimits} from './planningWorkspace';

describe('exploration and explicit treatment commitment',()=>{
  it('global limit edits rebase an open treatment draft and survive the later treatment commit',()=>{
    const p=demoProject(),edit=editTreatment(p,'tank','r50');
    edit.project.components.find(c=>c.id==='tank')!.planningNotes='Draf lokal tetap dipertahankan';
    const globallyUpdated=savePlanningLimits(p,{text:'8000000',source:'Batas pengguna',evidence:'USER_INPUT'},{text:'24',source:'Batas pengguna',evidence:'USER_INPUT'});
    const rebased=rebaseTreatmentEditLimits(p,edit,globallyUpdated);
    expect(p.parameters.find(v=>v.id===p.constraints.budget.id)!.value).toBe(12000000);
    expect(globallyUpdated.parameters.find(v=>v.id===globallyUpdated.constraints.budget.id)!.value).toBe(8000000);
    expect(rebased.project.parameters.find(v=>v.id===rebased.project.constraints.budget.id)!.value).toBe(8000000);
    expect(rebased.baseFingerprint).toBe(planningFingerprint(globallyUpdated));
    const committed=commitTreatmentEdit(globallyUpdated,rebased,rebased.project);
    expect(committed.parameters.find(v=>v.id===committed.constraints.budget.id)!.value).toBe(8000000);
    expect(committed.components.find(c=>c.id==='tank')!.planningNotes).toBe('Draf lokal tetap dipertahankan');
  });
  it('exploration/cancel does not mutate package, alternatives, or chosen-plan freshness',()=>{
    const p=setActiveComponents(demoProject(),[]);
    p.selectedPlan={definition:snapshotPlan(p,[],'baseline','Kondisi awal'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'User choice'};
    const before=structuredClone(p),fingerprint=planningFingerprint(p);
    for(const [family,biopori] of [['storage',false],['infiltration',true],['rain-garden',false]] as const){
      const session=exploreTreatment(p,family,'r50',undefined,biopori);
      expect(session.project.components.find(c=>c.id===session.id)!.targets).toEqual([]);
      expect(p).toEqual(before);expect(planningFingerprint(p)).toBe(fingerprint);
      expect(p.selectedPlan!.reviewedInputFingerprint).toBe(planningFingerprint(p));
    }
  });
  it('only contextual source intent pre-fills a source, never a placement or prior selected zone',()=>{
    const p=setActiveComponents(demoProject(),[]);
    const generic=exploreTreatment(p,'infiltration','r50',undefined,true);
    const contextual=exploreTreatment(p,'infiltration','r50','z0',true);
    expect(generic.project.components.find(c=>c.id===generic.id)!.targets).toEqual([]);
    expect(contextual.project.components.find(c=>c.id===contextual.id)!.targets).toEqual(['z0']);
    expect(contextual.project.components.find(c=>c.id===contextual.id)!.treatment!.installationZoneId).toBe(null);
  });
  it('commit changes the fingerprint while cancellation and local detail edits do not',()=>{
    const p=setActiveComponents(demoProject(),[]),edit=exploreTreatment(p,'storage','r50');
    edit.project.components.find(c=>c.id===edit.id)!.name='Tampungan halaman';
    expect(p.components.some(c=>c.name==='Tampungan halaman')).toBe(false);
    const committed=commitTreatmentEdit(p,edit,edit.project);
    expect(committed.components.find(c=>c.id===edit.id)!.enabled).toBe(true);
    expect(planningFingerprint(committed)).not.toBe(planningFingerprint(p));
  });
  it('rejects stale concurrent editor commits without losing current project changes',()=>{
    const p=demoProject(),edit=editTreatment(p,'tank','r50'),changed=structuredClone(p);
    changed.parameters.find(x=>x.id===p.constraints.budget.id)!.value=20;
    const checked=structuredClone(changed);
    expect(()=>commitTreatmentEdit(changed,edit,edit.project)).toThrow(/Data proyek berubah/);
    expect(changed).toEqual(checked);
    const storageOnly={...p,revision:p.revision+1};
    expect(commitTreatmentEdit(storageOnly,edit,edit.project).revision).toBe(storageOnly.revision);
  });
  it('first Biopori is not numbered by a Sumur draft and later same-method names are unique',()=>{
    const p=demoProject(),first=exploreTreatment(p,'infiltration','r50',undefined,true);
    expect(first.project.components.find(c=>c.id===first.id)!.name).toBe('Biopori');
    const second=exploreTreatment(first.project,'infiltration','r50',undefined,true);
    expect(second.project.components.find(c=>c.id===second.id)!.name).toBe('Biopori 2');
  });
  it('deletion clears current links/options but preserves immutable chosen/manual definitions',()=>{
    const p=demoProject();p.science!.interventions.tank!.overflow={kind:'intervention',id:'soak'};
    p.manualPlans=[snapshotPlan(p,['tank'],'saved','Saved')];
    const frozen=structuredClone(p.manualPlans);
    const next=deleteTreatment(p,'soak');
    expect(next.components.some(c=>c.id==='soak')).toBe(false);
    expect(next.optionGroups.flatMap(g=>g.choices.flatMap(c=>c.componentIds))).not.toContain('soak');
    expect(next.science!.interventions.tank!.overflow).toEqual({kind:'unknown'});
    expect(next.science!.interventions.soak).toBeUndefined();expect(next.manualPlans).toEqual(frozen);
    expect(projectV2Schema.safeParse(next).success).toBe(true);
  });
});
describe('resource knowledge independently of hydrological readiness',()=>{
  it('known cost/land survives missing scientific performance',()=>{
    const p=setActiveComponents(demoProject(),['tank']);
    p.science!.interventions.tank!.performance={};
    expect(packageResources(p)).toEqual({cost:{known:3000000,unknown:0,total:3000000},area:{known:2,unknown:0,total:2}});
  });
  it('partial totals retain known subtotal, distinguish zero, and do not imply complete totals',()=>{
    const p=setActiveComponents(demoProject(),['tank','soak']);
    const soak=p.components.find(c=>c.id==='soak')!;
    for(const ref of [soak.totalCost,soak.occupiedArea]){ref.evidence='UNKNOWN';Object.assign(p.parameters.find(x=>x.id===ref.id)!,{value:null,evidence:'UNKNOWN',source:''});}
    expect(packageResources(p).cost).toEqual({known:3000000,unknown:1,total:null});
    const tank=p.components.find(c=>c.id==='tank')!;p.parameters.find(x=>x.id===tank.totalCost.id)!.value=0;
    expect(packageResources(p).cost).toEqual({known:0,unknown:1,total:null});
    expect(packageResources(setActiveComponents(p,[])).cost).toEqual({known:0,unknown:0,total:0});
  });
});
