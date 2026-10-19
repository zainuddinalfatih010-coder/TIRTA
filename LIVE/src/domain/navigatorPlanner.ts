import type {IntakeAnswers} from './guidedIntake';
import {navigatorFactRegistry,navigatorFactOrder,type NavigatorFact,type NavigatorFactId,type NavigatorMode,type NavigatorIntent,type NavigatorDestination,type NavigatorOutput} from './navigatorFacts';
export type NavigatorContext={mode:NavigatorMode;intent:NavigatorIntent;knowledge:IntakeAnswers;deferredFactIds:NavigatorFactId[];completedTaskIds:string[];focusZoneId?:string;focusTreatmentId?:string};
export type NavigatorTask={id:string;kind:'atomic'|'compact-bundle'|'field-mission';factIds:NavigatorFactId[];reasonCode:'supply-data'|'repair-state'|'collect-field'|'complete-comparison';blockingOutput:NavigatorOutput;recommendedMode:NavigatorMode;modeHints:NavigatorMode[];returnDestination:NavigatorDestination};
export const factIsAvailable=(fact:NavigatorFact)=>fact.status==='known'||fact.status==='not-applicable';
/** Bundles share object/scenario/context and never cross a branch prerequisite. */
export function composeSafeBundle(anchor:NavigatorFact,facts:NavigatorFact[],mode:NavigatorMode):NavigatorFact[]{
 const definition=navigatorFactRegistry[anchor.key],bundle=definition.bundle;
 if(bundle==='roof-routing')return facts.filter(f=>f.objectId===anchor.objectId&&f.scenarioId===anchor.scenarioId&&navigatorFactRegistry[f.key].bundle===bundle);
 if(!bundle||(mode==='guided'&&bundle!=='resources'&&bundle!=='constraints'))return [anchor];
 const ready=(f:NavigatorFact)=>!navigatorFactRegistry[f.key].branchDependency||facts.some(d=>d.key===navigatorFactRegistry[f.key].branchDependency&&d.objectId===f.objectId&&factIsAvailable(d));
 if(!ready(anchor))return [anchor];
 const related=facts.filter(f=>!factIsAvailable(f)&&f.scope===anchor.scope&&f.objectId===anchor.objectId&&f.scenarioId===anchor.scenarioId&&f.zoneId===anchor.zoneId&&f.consequence===anchor.consequence&&navigatorFactRegistry[f.key].bundle===bundle&&ready(f));
 return related.sort((a,b)=>navigatorFactOrder(a)-navigatorFactOrder(b)||a.id.localeCompare(b.id)).slice(0,4);
}
export function planNavigatorTask({facts,context}:{facts:NavigatorFact[];context:NavigatorContext}):NavigatorTask|null {
 const pending=facts.filter(f=>!factIsAvailable(f)&&(!f.optional||f.status==='invalid'||f.status==='stale')&&(!context.deferredFactIds.includes(f.id)||f.status==='invalid'||f.status==='stale'));
 if(!pending.length)return null;
 const eligible=pending.filter(f=>{const branch=navigatorFactRegistry[f.key].branchDependency;return !branch||facts.some(d=>d.objectId===f.objectId&&d.scenarioId===f.scenarioId&&d.key===branch&&factIsAvailable(d));});
 if(!eligible.length)return null;
 const knowledge=(f:NavigatorFact)=>context.knowledge[f.key==='cost'||f.key==='area'?f.key:f.group==='parcel'||f.group==='rainfall'||f.group==='selection'?'connection':f.group];
 const output=(f:NavigatorFact):NavigatorOutput=>f.blockingOutput??(f.consequence==='water'?'water':f.consequence==='comparison'?'comparison':'field');
 // Explicit, ordered criteria; no hidden weighted score or scientific ranking.
 const priority=(f:NavigatorFact)=>[
  context.focusTreatmentId?(f.objectId===context.focusTreatmentId?0:1):context.focusZoneId?(f.zoneId===context.focusZoneId?0:1):navigatorFactRegistry[f.key].intent?.includes(context.intent)?0:1,
  f.status==='invalid'||f.status==='stale'?0:1,
  ['baseline','water','comparison','field'].indexOf(output(f)),
  knowledge(f)==='yes'?0:knowledge(f)==='partly'?1:2,
  f.consequence==='field'?1:0,
  navigatorFactRegistry[f.key].bundle?0:1,
  f.consequence==='comparison'?1:0,
  f.consequence==='field'?1:0,
  navigatorFactOrder(f),
 ];
 const ordered=[...eligible].sort((a,b)=>{const x=priority(a),y=priority(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]!-y[i]!;return a.id.localeCompare(b.id);});
 const anchor=ordered[0]!;const candidates=facts.filter(f=>!context.deferredFactIds.includes(f.id)||f.status==='invalid'||f.status==='stale');const selected=composeSafeBundle(anchor,candidates,context.mode);const mission=context.mode==='field'&&anchor.consequence==='field';
 const kind=mission?'field-mission':selected.length>1?'compact-bundle':'atomic';
 const repair=anchor.status==='invalid'||anchor.status==='stale';
 return {id:`task:${anchor.scope}:${encodeURIComponent(anchor.objectId)}:${encodeURIComponent(anchor.scenarioId)}:${selected.map(f=>f.key).join('+')}`,kind,factIds:selected.map(f=>f.id),reasonCode:repair?'repair-state':mission?'collect-field':anchor.consequence==='comparison'?'complete-comparison':'supply-data',blockingOutput:output(anchor),recommendedMode:context.mode,modeHints:kind==='atomic'?['guided','fast','field']:mission?['field']:['guided','fast'],returnDestination:anchor.destination??navigatorFactRegistry[anchor.key].destination};
}
