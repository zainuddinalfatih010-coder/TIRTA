import {describe,it,expect} from 'vitest';
import {NavigatorJourneyRepository} from './NavigatorJourneyRepository';
import {newNavigatorJourney,reconcileJourney} from '../domain/navigatorJourney';
import {demoProject} from '../direction/productionBridge';
import {interventionNavigatorFacts} from '../domain/navigatorIntervention';
import {DatabaseSync} from 'node:sqlite';
import {SqliteStorage} from './sqlite';
async function storage(){const db=new DatabaseSync(':memory:');const s=new SqliteStorage({execute:async sql=>{db.exec(sql);},query:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{db.prepare(sql).run(...values);},close:()=>db.close()});await s.initialize();return s;}
import {ProjectRepository} from './ProjectRepository';
describe('Navigator journey persistence',()=>{
 it('persists the first meaningful answer outside the project',async()=>{
 const s=await storage(), repo=new NavigatorJourneyRepository(s),p=demoProject(), before=JSON.stringify(p);
 const j={...newNavigatorJourney(p.id),intent:'storage' as const,orientation:['goal' as const]};
 await repo.write(p.id,j);expect(await repo.read(p.id)).toEqual(j);expect(JSON.stringify(p)).toBe(before);s.close();
 });
 it('rejects corrupt and future settings without blocking projects',async()=>{
 const s=await storage(),repo=new NavigatorJourneyRepository(s);
 await s.writeSetting('navigator-journey:p',{schemaVersion:99});expect(await repo.read('p')).toBe(null);
 await s.writeSetting('navigator-journey:p',{schemaVersion:1,projectId:'other'});expect(await repo.read('p')).toBe(null);s.close();
 });
 it('drops deleted references and recomputes rather than trusting a stale screen',()=>{
 const p=demoProject(),j={...newNavigatorJourney(p.id),focusZoneId:'deleted',focusTreatmentId:'deleted',currentTaskId:'obsolete',deferredFactIds:['treatment:deleted:r50:capacity' as const]};
 const next=reconcileJourney(p,j,interventionNavigatorFacts(p,'tank','r50'));
 expect(next.focusZoneId).toBeUndefined();expect(next.focusTreatmentId).toBeUndefined();expect(next.deferredFactIds).toEqual([]);expect(next.currentTaskId).not.toBe('obsolete');
 });
 it('invalidates only changed deferred facts and retains independent knowledge',()=>{
 const p=demoProject(),f=interventionNavigatorFacts(p,'tank','r50'), cost=f.find(x=>x.key==='cost')!,soil=f.find(x=>x.key==='capacity')!;
 const j={...newNavigatorJourney(p.id),knowledge:{cost:'yes' as const},deferredFactIds:[cost.id,soil.id],factFingerprints:{[cost.id]:cost.fingerprint!,[soil.id]:'old'}};
 const next=reconcileJourney(p,j,f);expect(next.deferredFactIds).toEqual([cost.id]);expect(next.knowledge.cost).toBe('yes');
 });
 it('retains deferrals for facts without a revision fingerprint',()=>{
 const p=demoProject(),fact=interventionNavigatorFacts(p,'tank','r50')[0]!;delete fact.fingerprint;
 const j={...newNavigatorJourney(p.id),deferredFactIds:[fact.id],factFingerprints:{[fact.id]:fact.valueLabel}};
 expect(reconcileJourney(p,j,[fact]).deferredFactIds).toEqual([fact.id]);
 });
 it('records last active project without changing scientific values',async()=>{
 const s=await storage(),r=new ProjectRepository(s),p=await r.create('active','Aktif'),before=await s.readRaw(p.id);
 await r.select(p.id);expect(await r.selectedId()).toBe(p.id);expect(await s.readRaw(p.id)).toBe(before);s.close();
 });
});

it('backup carries validated journey outside scientific project and rebases imported convenience IDs',async()=>{const s=await storage(),repo=new ProjectRepository(s),jrepo=new NavigatorJourneyRepository(s),p=await repo.create('original','Portable');const key='project:original:r50:geometry' as const;const j={...newNavigatorJourney(p.id),mode:'field' as const,intent:'roof-runoff' as const,orientation:['goal' as const],deferredFactIds:[key],factFingerprints:{[key]:'unchanged'}};await jrepo.write(p.id,j);const backup=await repo.exportJson(p.id);expect(JSON.parse(backup).project).not.toHaveProperty('navigatorJourney');const imported=await repo.importJson(backup,'copy');const restored=await jrepo.read('copy');expect(restored).toMatchObject({projectId:'copy',intent:'roof-runoff',mode:'field',orientation:['goal'],deferredFactIds:['project:copy:r50:geometry']});expect(imported.warnings).toEqual([]);expect(restored?.factFingerprints['project:copy:r50:geometry']).toBe('unchanged');s.close();});
it('invalid or foreign journey metadata cannot overwrite another project',async()=>{const s=await storage(),repo=new ProjectRepository(s),p=await repo.create('original','Portable');const backup=JSON.parse(await repo.exportJson(p.id));backup.navigatorJourney={...newNavigatorJourney('foreign'),intent:'storage'};const result=await repo.importJson(JSON.stringify(backup),'copy');expect(result.project.id).toBe('copy');expect(result.warnings).toHaveLength(1);expect(await new NavigatorJourneyRepository(s).read('copy')).toBeNull();s.close();});

it('portable journey retains the active nonfirst rain scenario',async()=>{const s=await storage(),repo=new ProjectRepository(s),p=await repo.save(demoProject(),null),jrepo=new NavigatorJourneyRepository(s);await jrepo.write(p.id,{...newNavigatorJourney(p.id),activeScenarioId:'r50'});await s.writeSetting(`active-scenario:${p.id}`,'r100');const backup=await repo.exportJson(p.id);expect(JSON.parse(backup).navigatorJourney.activeScenarioId).toBe('r100');await repo.importJson(backup,'copy');expect(await s.readSetting('active-scenario:copy')).toBe('r100');s.close();});
