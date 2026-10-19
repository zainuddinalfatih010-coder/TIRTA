import type {ProjectRepository} from '../persistence/ProjectRepository';
import type {ProjectStorage} from '../persistence/storage';
import {NavigatorJourneyRepository} from '../persistence/NavigatorJourneyRepository';
import {newNavigatorJourney,reconcileJourney} from '../domain/navigatorJourney';
import {navigatorProjectFacts} from './navigatorActions';
import {navigatorFactRegistry} from '../domain/navigatorFacts';
import {planNavigatorTask} from '../domain/navigatorPlanner';
import {isNavigatorFactId} from '../domain/navigatorFacts';
export type NavigatorResume={id:string;name:string;next:string;mode:'guided'|'fast'|'field'};
export async function readNavigatorResume(repository:ProjectRepository,storage:ProjectStorage):Promise<NavigatorResume|null>{
 const id=await repository.selectedId();if(!id)return null;
 const record=await repository.read(id);if(!record.project||record.recovered)return null;
 const p=record.project,setting=await storage.readSetting(`active-scenario:${id}`),sid=typeof setting==='string'&&p.scenarios.some(s=>s.id===setting)?setting:p.scenarios[0]?.id??'pending';
 const saved=await new NavigatorJourneyRepository(storage).read(id)??newNavigatorJourney(id);
 const facts=navigatorProjectFacts(p,sid,saved.focusTreatmentId,saved.intent),j=reconcileJourney(p,saved,facts),task=planNavigatorTask({facts,context:{...j,deferredFactIds:j.deferredFactIds.filter(isNavigatorFactId)}});
 const next=!j.orientation.includes('goal')?'Apa yang ingin Anda tangani?':!j.orientation.includes('knowledge')?'Data apa yang sudah Anda punya?':!j.orientation.includes('method')?'Penanganan yang ingin diuji':j.preferredFamily!=='undecided'&&!j.orientation.includes('priority')?'Prioritas perbandingan':task?task.kind==='field-mission'?'Pemeriksaan lokasi':task.factIds.map(id=>{const f=facts.find(f=>f.id===id)!;return f.label??navigatorFactRegistry[f.key].label;}).join(' dan '):'Rencana data dan pilihan yang siap';
 return {id,name:p.name,next,mode:j.mode};
}
