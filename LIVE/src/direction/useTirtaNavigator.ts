import {useEffect,useMemo,useRef,useState} from 'react';
import type {ProjectV2} from '../domain/projectV2';
import {newNavigatorJourney,reconcileJourney,type NavigatorJourney} from '../domain/navigatorJourney';
import {planNavigatorTask} from '../domain/navigatorPlanner';
import {isNavigatorFactId,type NavigatorFact,type NavigatorMode} from '../domain/navigatorFacts';
import {NavigatorJourneyRepository} from '../persistence/NavigatorJourneyRepository';
import {openGoldenPersistence} from './persistenceBridge';
import {answerOrientation,navigatorProjectFacts,navigatorToolAction} from './navigatorActions';

export function useTirtaNavigator(project:ProjectV2,scenario:string,active:boolean){
 const [saved,setSaved]=useState<NavigatorJourney|null>(null),[loadedId,setLoadedId]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const queue=useRef(Promise.resolve()),pendingWrites=useRef(0);
 useEffect(()=>{let alive=true;void openGoldenPersistence().then(({storage})=>new NavigatorJourneyRepository(storage).read(project.id)).then(j=>{if(alive){setSaved(j);setLoadedId(project.id);setError('');}}).catch(e=>{if(alive){setError(String(e));setLoadedId(project.id);}});return()=>{alive=false;};},[project.id]);
 const base=useMemo(()=>saved?.projectId===project.id?saved:newNavigatorJourney(project.id),[saved,project.id]);
 const facts=useMemo(()=>navigatorProjectFacts(project,scenario,base.focusTreatmentId,base.intent),[project,scenario,base.focusTreatmentId,base.intent]);
 const journey=useMemo(()=>reconcileJourney(project,base,facts),[project,base,facts]);
 const task=useMemo(()=>planNavigatorTask({facts,context:{...journey,deferredFactIds:journey.deferredFactIds.filter(isNavigatorFactId)}}),[facts,journey]);
 const persist=(next:NavigatorJourney)=>{
 const value={...next,activeScenarioId:scenario,updatedAt:new Date().toISOString()};setSaved(value);pendingWrites.current++;setSaving(true);setError('');
 queue.current=queue.current.catch(()=>{}).then(async()=>{const {storage}=await openGoldenPersistence();await new NavigatorJourneyRepository(storage).write(value.projectId,value);}).catch(e=>setError(`Progres belum tersimpan. ${String(e)}`)).finally(()=>{pendingWrites.current--;setSaving(pendingWrites.current>0);});
 };
 const answer=(step:NavigatorJourney['orientation'][number],value:Partial<NavigatorJourney>)=>persist(answerOrientation(journey,step,value));
 const defer=()=>{if(task)persist({...journey,deferredFactIds:[...new Set([...journey.deferredFactIds,...task.factIds])],currentTaskId:null});};
 const mode=(mode:NavigatorMode)=>persist({...journey,mode});
 const tool=(fact:NavigatorFact)=>{const action=navigatorToolAction(fact);persist({...journey,returnDestination:action.destination,currentTaskId:task?.id??null});return action;};
 const returned=()=>persist({...journey,returnDestination:null});
 const revisit=(fact:NavigatorFact)=>persist({...journey,deferredFactIds:journey.deferredFactIds.filter(id=>id!==fact.id),focusTreatmentId:fact.scope==='treatment'?fact.objectId:undefined,focusZoneId:fact.zoneId});
 const reorient=()=>persist({...journey,orientation:[],returnDestination:null,currentTaskId:null});
 const clearTreatmentFocus=()=>persist({...journey,focusTreatmentId:undefined});
 const focusTreatment=(id:string)=>persist({...journey,focusTreatmentId:id});
 return {journey,facts,task,reorient,clearTreatmentFocus,focusTreatment,answer,defer,mode,tool,returned,revisit,saving,error,ready:active&&loadedId===project.id};
}
export type TirtaNavigatorState=ReturnType<typeof useTirtaNavigator>;
