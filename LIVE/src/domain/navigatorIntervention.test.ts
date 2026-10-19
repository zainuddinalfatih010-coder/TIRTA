import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { interventionNavigatorFacts, interventionNextActions } from './navigatorIntervention';
import { composeSafeBundle } from './navigatorPlanner';
describe('Navigator canonical intervention adapter', () => {
 it('tank never asks for infiltration or groundwater', () => {
 const p=demoProject(), f=interventionNavigatorFacts(p,'tank','r50');
 expect(f.some(x=>['soil','groundwater','media'].includes(x.key))).toBe(false);
 expect(f.find(x=>x.key==='capacity')?.status).toBe('known');
 });
 it('resapan and rain garden expose their own applicable site requirements',()=>{
 const p=demoProject();
 expect(interventionNavigatorFacts(p,'soak','r50').some(x=>x.key==='soil')).toBe(true);
 expect(interventionNavigatorFacts(p,'garden','r50').some(x=>x.key==='media')).toBe(true);
 });
 it('Biopori rejects roofs and accepts all non-roof receivers through the existing validator',()=>{
 const p=demoProject(), c=p.components.find(x=>x.id==='soak')!;
 if(c.family!=='infiltration')throw Error('fixture'); c.infiltrationType='biopori';
 c.treatment={installationZoneId:'z0',sharedSourceMode:'ledger',allocationNote:'Declared',catchmentReviewed:true};
 expect(interventionNextActions(p,c.id,'r50').some(x=>x.field==='installation'&&x.ruleId==='BIOPORI_SITE')).toBe(true);
 for(const installationZoneId of ['z1','z2','z3','z4']){
  c.treatment.installationZoneId=installationZoneId;
  expect(interventionNextActions(p,c.id,'r50').some(x=>x.field==='installation'&&x.ruleId==='BIOPORI_SITE')).toBe(false);
 }
 });
 it('resources retain known values when water is blocked; unknown is never zero',()=>{
 const p=demoProject(),c=p.components.find(x=>x.id==='tank')!; c.targets=[];
 if(c.family!=='storage')throw Error('fixture'); const ref=c.performanceByScenario.r50!.availableStorage;
 Object.assign(p.parameters.find(x=>x.id===ref.id)!,{value:null,evidence:'UNKNOWN',source:''});ref.evidence='UNKNOWN';
 const f=interventionNavigatorFacts(p,c.id,'r50');
 expect(f.find(x=>x.key==='cost')?.status).toBe('known');
 expect(f.find(x=>x.key==='area')?.status).toBe('known');
 expect(f.find(x=>x.key==='capacity')).toMatchObject({status:'unknown',valueLabel:'Belum diisi'});
 });
 it('capacity can bundle but unresolved source and route cannot',()=>{
 const p=demoProject(),c=p.components.find(x=>x.id==='tank')!;c.targets=[];
 if(c.family!=='storage')throw Error('fixture'); const ref=c.performanceByScenario.r50!.availableStorage;
 Object.assign(p.parameters.find(x=>x.id===ref.id)!,{value:null,evidence:'UNKNOWN',source:''});ref.evidence='UNKNOWN';
 p.science!.interventions.tank!.performance.r50!.origin='unknown';
 const f=interventionNavigatorFacts(p,c.id,'r50');
 expect(composeSafeBundle(f.find(x=>x.key==='capacity')!,f,'fast').length).toBeGreaterThan(1);
 expect(composeSafeBundle(f.find(x=>x.key==='source')!,f,'fast')).toHaveLength(1);
 expect(f.find(x=>x.key==='via')?.dependencies).toContain(f.find(x=>x.key==='source')!.id);
 });
 it('deleted components produce no facts while proposal-core permeable exposes inspectable requirements',()=>{
 const p=demoProject();expect(interventionNavigatorFacts(p,'deleted','r50')).toEqual([]);
 const facts=interventionNavigatorFacts(p,p.components.find(x=>x.family==='permeable')!.id,'r50');
 expect(facts.length).toBeGreaterThan(0);expect(facts.find(x=>x.key==='source')?.label).toBe('Zona yang diubah');
 });
});
