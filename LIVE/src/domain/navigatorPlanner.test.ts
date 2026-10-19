import {describe,it,expect} from 'vitest';
import {planNavigatorTask,composeSafeBundle} from './navigatorPlanner';
import {navigatorFactId,type NavigatorFact,type NavigatorFactKey} from './navigatorFacts';
import {newNavigatorJourney,reconcileJourney} from './navigatorJourney';
import {demoProject} from '../direction/productionBridge';
const fact=(key:NavigatorFactKey,extra:Partial<NavigatorFact>={}):NavigatorFact=>({id:`treatment:bio:r50:${key}`,key,scope:'treatment',objectId:'bio',scenarioId:'r50',group:key==='cost'||key==='area'?'resources':'connection',status:'unknown',valueLabel:'Belum diketahui',consequence:key==='cost'||key==='area'?'comparison':'water',why:'Untuk menguji keluaran yang sesuai',dependencies:[],...extra});
const context={mode:'guided' as const,intent:'explore' as const,knowledge:{},deferredFactIds:[],completedTaskIds:[]};
describe('Navigator selects supported work without creating scientific facts',()=>{
 it('low knowledge starts with a branch-defining source instead of collecting a route without its source',()=>{
  const source=fact('source'),route=fact('via',{dependencies:[source.id]});
  expect(planNavigatorTask({facts:[route,source],context})?.factIds).toEqual(['treatment:bio:r50:source']);
 });
 it('Fast mode bundles independent cost and occupied area on the same treatment',()=>{
  const task=planNavigatorTask({facts:[fact('cost'),fact('area')],context:{...context,mode:'fast'}});
  expect(task?.kind).toBe('compact-bundle');expect(task?.factIds).toEqual(['treatment:bio:r50:cost','treatment:bio:r50:area']);
 });
 it('never batches route applicability before the source is declared',()=>{
  const source=fact('source'),route=fact('via',{dependencies:[source.id]});
  expect(composeSafeBundle(source,[source,route],'fast').map(f=>f.key)).toEqual(['source']);
 });
 it('knowledge yes only changes order, never marks an unknown capacity as known',()=>{
  const capacity=fact('capacity',{group:'capacity'}),before=structuredClone(capacity);
  expect(planNavigatorTask({facts:[capacity],context:{...context,knowledge:{capacity:'yes'}}})?.factIds).toEqual(['treatment:bio:r50:capacity']);
  expect(capacity).toEqual(before);expect(capacity.status).toBe('unknown');
 });
 it('returns the same next task independently of input iteration order',()=>{
  const facts=[fact('cost'),fact('area')];
  expect(planNavigatorTask({facts,context})).toEqual(planNavigatorTask({facts:[...facts].reverse(),context}));
 });
 it('Field mode groups independent checks at one location rather than combining different sites',()=>{
  const condition=fact('condition',{group:'site',consequence:'field',zoneId:'east'}),maintenance=fact('maintenance',{group:'site',consequence:'field',zoneId:'east'}),other=fact('field',{objectId:'other',id:'treatment:other:r50:field',group:'site',consequence:'field',zoneId:'west'});
  const task=planNavigatorTask({facts:[condition,maintenance,other],context:{...context,mode:'field',focusZoneId:'east'}});
  expect(task?.kind).toBe('field-mission');expect(task?.factIds).toEqual(['treatment:bio:r50:condition','treatment:bio:r50:maintenance']);
 });
 it('a deferred fact remains in the ledger but is not asked again unless invalid or stale',()=>{
  const source=fact('source');expect(planNavigatorTask({facts:[source],context:{...context,deferredFactIds:[source.id]}})).toBeNull();
  expect(planNavigatorTask({facts:[{...source,status:'stale'}],context:{...context,deferredFactIds:[source.id]}})?.reasonCode).toBe('repair-state');
 });
 it('repairing a conflict precedes optional field notes',()=>{
  const task=planNavigatorTask({facts:[fact('maintenance',{group:'site',consequence:'field'}),fact('installation',{status:'invalid'})],context});
  expect(task?.factIds).toEqual(['treatment:bio:r50:installation']);
 });
 it('a completed task marker cannot hide a canonically unknown fact',()=>{
  const source=fact('source');const first=planNavigatorTask({facts:[source],context})!;
  expect(planNavigatorTask({facts:[source],context:{...context,completedTaskIds:[first.id]}})?.factIds).toEqual([source.id]);
 });
 it('registered IDs reject unsupported fields instead of creating a runtime question',()=>{
  expect(()=>navigatorFactId('treatment','bio','r50','invented-rate' as NavigatorFactKey)).toThrow();
 });
 it('known zero and not-applicable facts do not create another task',()=>{
  expect(planNavigatorTask({facts:[fact('cost',{status:'known',valueLabel:'0 Rp'}),fact('soil',{status:'not-applicable'})],context})).toBeNull();
 });
 it('deferring the branch prerequisite yields a data plan rather than a dependent route',()=>{
 const source=fact('source'),via=fact('via',{dependencies:[source.id]});
 expect(planNavigatorTask({facts:[source,via],context:{...context,deferredFactIds:[source.id]}})).toBeNull();
 });
});

it('does not offer branch-dependent route with an absent source fact',()=>{expect(planNavigatorTask({facts:[fact('via')],context})).toBeNull();});
it('optional roof pitch does not block while drainage is known',()=>{expect(planNavigatorTask({facts:[fact('roofPitch',{scope:'zone',optional:true}),fact('roofDrainage',{scope:'zone',status:'known'})],context})).toBeNull();});

it('keeps the delegated task identity while the user is inside its workspace',()=>{
 const p=demoProject(),source=fact('source'),via=fact('via',{dependencies:[source.id]});
 const first=planNavigatorTask({facts:[source,via],context})!;
 const delegated=newNavigatorJourney(p.id);delegated.orientation=['goal','knowledge','method'];delegated.returnDestination='interventions';delegated.currentTaskId=first.id;
 const nextFacts=[{...source,status:'known' as const},via];
 const reconciled=reconcileJourney(p,delegated,nextFacts);
 expect(planNavigatorTask({facts:nextFacts,context:{...context}})?.id).not.toBe(first.id);
 expect(reconciled.currentTaskId).toBe(first.id);
});
