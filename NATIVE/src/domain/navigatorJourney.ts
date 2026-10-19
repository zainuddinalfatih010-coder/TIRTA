import {z} from 'zod';
import type {ProjectV2} from './projectV2';
import {isNavigatorFactId,type NavigatorFact} from './navigatorFacts';
import {planNavigatorTask} from './navigatorPlanner';
export const navigatorJourneySchema=z.object({
 activeScenarioId:z.string().optional(),schemaVersion:z.literal(1),projectId:z.string().min(1),mode:z.enum(['guided','fast','field']),intent:z.enum(['ponding','roof-runoff','hard-runoff','storage','explore']),
 knowledge:z.object({connection:z.enum(['yes','partly','unknown']).optional(),capacity:z.enum(['yes','partly','unknown']).optional(),site:z.enum(['yes','partly','unknown']).optional(),resources:z.enum(['yes','partly','unknown']).optional(),cost:z.enum(['yes','partly','unknown']).optional(),area:z.enum(['yes','partly','unknown']).optional()}),
 focusZoneId:z.string().optional(),focusTreatmentId:z.string().optional(),preferredFamily:z.enum(['tank','resapan','garden','permeable','biopori','undecided']).optional(),
 comparisonPriority:z.enum(['water','cost','land','storage','undecided']).optional(),
 orientation:z.array(z.enum(['goal','knowledge','method','priority'])).default([]),
 completedTaskIds:z.array(z.string()).max(1000),deferredFactIds:z.array(z.string().refine(isNavigatorFactId)).max(1000),
 factFingerprints:z.record(z.string(),z.string()).default({}),currentTaskId:z.string().nullable(),returnDestination:z.enum(['studio','rain','interventions','alternatives','impact']).nullable(),updatedAt:z.string(),
});
export type NavigatorJourney=z.infer<typeof navigatorJourneySchema>;
export function newNavigatorJourney(projectId:string):NavigatorJourney {
 return {schemaVersion:1,projectId,mode:'guided',intent:'explore',knowledge:{},orientation:[],completedTaskIds:[],deferredFactIds:[],factFingerprints:{},currentTaskId:null,returnDestination:null,updatedAt:new Date().toISOString()};
}
/** Reconcile convenience state only. Never writes or repairs canonical science. */
export function reconcileJourney(project:ProjectV2,journey:NavigatorJourney,facts:NavigatorFact[]):NavigatorJourney {
 const parsed=navigatorJourneySchema.safeParse(journey);
 const current=parsed.success&&parsed.data.projectId===project.id?parsed.data:newNavigatorJourney(project.id);
 const focusZoneId=project.zones.some(z=>z.id===current.focusZoneId)?current.focusZoneId:undefined;
 const focusTreatmentId=project.components.some(c=>c.id===current.focusTreatmentId)?current.focusTreatmentId:undefined;
 const deferredFactIds=current.deferredFactIds.filter(id=>{
  const fact=facts.find(f=>f.id===id);return fact&&(!current.factFingerprints[id]||current.factFingerprints[id]===(fact.fingerprint??fact.valueLabel));
 });
 const context={...current,focusZoneId,focusTreatmentId,deferredFactIds:deferredFactIds.filter(isNavigatorFactId)};
 const task=planNavigatorTask({facts,context});
 return {...current,focusZoneId,focusTreatmentId,deferredFactIds,factFingerprints:Object.fromEntries(facts.map(f=>[f.id,f.fingerprint??f.valueLabel])),currentTaskId:current.returnDestination&&current.currentTaskId?current.currentTaskId:task?.id??null};
}

/** Rebase convenience identifiers on import; canonical zones and science stay untouched. */
export function importNavigatorJourney(raw:unknown,oldProjectId:string,newProjectId:string):NavigatorJourney|null{
 const parsed=navigatorJourneySchema.safeParse(raw);if(!parsed.success||parsed.data.projectId!==oldProjectId)return null;
 const j=parsed.data,from=`project:${encodeURIComponent(oldProjectId)}:`,to=`project:${encodeURIComponent(newProjectId)}:`;
 const rebase=(id:string)=>id.startsWith(from)?to+id.slice(from.length):id;
 return {...j,projectId:newProjectId,deferredFactIds:j.deferredFactIds.map(rebase).filter(isNavigatorFactId),factFingerprints:Object.fromEntries(Object.entries(j.factFingerprints).map(([id,value])=>[rebase(id),value])),currentTaskId:null,returnDestination:null};
}
