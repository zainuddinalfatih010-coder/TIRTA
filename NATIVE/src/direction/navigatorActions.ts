import {roofNavigatorFacts} from '../domain/navigatorRoof';
import {planningParameterValue} from '../domain/planningEngine';
import type {ProjectV2} from '../domain/projectV2';
import {workflowReadiness} from '../domain/workflowReadiness';
import {fieldDecisionReadiness} from '../domain/fieldDecisionReadiness';
import {interventionNavigatorFacts} from '../domain/navigatorIntervention';
import {navigatorFactId,navigatorFactRegistry,isNavigatorFactId,type NavigatorFact,type NavigatorFactKey} from '../domain/navigatorFacts';
import {navigatorJourneySchema,type NavigatorJourney} from '../domain/navigatorJourney';

export function answerOrientation(journey:NavigatorJourney,step:NavigatorJourney['orientation'][number],answer:Partial<NavigatorJourney>):NavigatorJourney {
 const permitted=step==='goal'?{intent:answer.intent}:step==='knowledge'?{knowledge:answer.knowledge,mode:journey.mode==='field'?'field':Object.values(answer.knowledge??{}).filter(v=>v==='yes').length>=4?'fast':journey.mode}:step==='method'?{preferredFamily:answer.preferredFamily}:{comparisonPriority:answer.comparisonPriority};
 return navigatorJourneySchema.parse({...journey,...permitted,orientation:[...new Set([...journey.orientation,step])],updatedAt:new Date().toISOString()});
}
export function navigatorToolAction(fact:NavigatorFact){
 if(!isNavigatorFactId(fact.id)||!Object.hasOwn(navigatorFactRegistry,fact.key)||fact.id.split(':')[3]!==fact.key)throw new Error('Tindakan Navigator tidak terdaftar.');
 return {destination:fact.destination??navigatorFactRegistry[fact.key].destination,field:fact.key,zoneId:fact.scope==='zone'?fact.objectId:fact.zoneId,
 componentId:fact.scope==='treatment'?fact.objectId:undefined,scenarioId:fact.scenarioId,section:fact.group};
}
/** Project ledger projects existing readiness only; no formulas or scientific defaults. */
export function navigatorProjectFacts(project:ProjectV2,scenarioId:string,focusTreatmentId?:string,intent:import('../domain/navigatorFacts').NavigatorIntent='explore'):NavigatorFact[]{
 const readiness=workflowReadiness(project,scenarioId,{evaluated:0,rows:[],issues:[]});
 const decision=fieldDecisionReadiness(project,scenarioId);
 const issueKey=(field:string):NavigatorFactKey=>field==='dimensions'||field==='coverage'?'geometry':field==='coefficientSource'?'coefficient':field==='rainfallSource'?'rainfall':Object.hasOwn(navigatorFactRegistry,field)?field as NavigatorFactKey:'geometry';
 const facts:NavigatorFact[]=[];
 const add=(key:NavigatorFactKey,objectId:string,scope:'project'|'zone',known:boolean,why:string)=>{
 const id=navigatorFactId(scope,objectId,scenarioId||'pending',key);
 if(facts.some(f=>f.id===id))return;
 facts.push({id,key,scope,objectId,scenarioId:scenarioId||'pending',zoneId:scope==='zone'?objectId:undefined,
 group:key==='rainfall'?'rainfall':'parcel',status:known?'known':'unknown',valueLabel:known?'Diterapkan':'Belum diisi',label:navigatorFactRegistry[key].label,
 consequence:'water',why,dependencies:[],blockingOutput:'baseline',destination:navigatorFactRegistry[key].destination,fingerprint:JSON.stringify([known,why])});
 };
 add('geometry',project.id,'project',!readiness.rain.some(i=>['dimensions','geometry','coverage'].includes(i.field)&&!i.zoneId),'Batas persil diperlukan untuk memeriksa luas yang terwakili.');
 add('zones',project.id,'project',!!project.zones.length,'Zona menunjukkan bagian lahan yang menghasilkan limpasan.');
 for(const zone of project.zones)for(const key of ['geometry','surface','coefficient'] as const){
 const issue=readiness.rain.find(i=>i.zoneId===zone.id&&issueKey(i.field)===key);
 add(key,zone.id,'zone',!issue,issue?.message??`${zone.name} — data tersedia.`);
 }
 const rainIssues=decision.baseline.actions.filter(i=>i.stage==='rain');
 const scenario=project.scenarios.find(s=>s.id===scenarioId);let rainKnown=false;
 if(scenario){try{const ref=scenario.overrides.find(o=>o.baseParameterId===scenario.rainfall.id)?.replacement??scenario.rainfall;planningParameterValue(project.parameters,ref,'mm','Hujan');rainKnown=true;}catch{/* Canonical unknown/source validation. */}}
 add('rainfall',project.id,'project',rainKnown,rainIssues[0]?.message??'Terapkan hujan yang ingin diuji beserta sumber angkanya.');
 for(const c of project.components.filter(c=>c.family!=='permeable'&&(c.enabled||c.id===focusTreatmentId)))facts.push(...interventionNavigatorFacts(project,c.id,scenarioId));
 if(!project.components.some(c=>c.enabled&&c.family!=='permeable'))facts.push({id:navigatorFactId('project',project.id,scenarioId||'pending','options'),key:'options',scope:'project',objectId:project.id,scenarioId:scenarioId||'pending',group:'selection',status:'unknown',valueLabel:'Belum ada penanganan aktif',consequence:'water',why:'Lihat pilihan, lalu tambahkan penanganan yang ingin Anda uji. Pilihan tidak ditambahkan otomatis.',dependencies:[],blockingOutput:'water',destination:'interventions'});
 // Aggregate and selected-plan blockers remain canonical, including required other rain scenarios.
 for(const a of [...decision.activePackage.actions,...decision.selected.actions]){
 const mapped=a.field==='alternatives'?'selection':a.field==='minInstallations'?'options':a.field==='constraints'?'budget':a.field;
 if(!Object.hasOwn(navigatorFactRegistry,mapped))continue;
 const key=mapped as NavigatorFactKey,scope=a.componentId?'treatment':a.zoneId?'zone':'project',objectId=a.componentId??a.zoneId??project.id;
 const id=navigatorFactId(scope,objectId,a.scenarioId||scenarioId||'pending',key),existing=facts.find(f=>f.id===id);
 if(existing){if(a.severity==='incompatible'||a.severity==='stale')existing.status=a.severity==='stale'?'stale':'invalid';continue;}
 facts.push({id,key,scope,objectId,scenarioId:a.scenarioId||scenarioId||'pending',zoneId:a.zoneId,group:key==='rainfall'?'rainfall':key==='selection'?'selection':key==='budget'||key==='land'?'resources':'connection',status:a.severity==='stale'?'stale':a.severity==='incompatible'?'invalid':'unknown',valueLabel:'Perlu ditinjau',label:a.label,why:a.consequence,consequence:a.section==='constraints'||a.section==='resources'||a.section==='selection'?'comparison':'water',dependencies:[],blockingOutput:key==='rainfall'?'baseline':a.section==='constraints'||a.section==='resources'||a.section==='selection'?'comparison':'water',destination:a.stage==='rain'?'rain':a.stage==='studio'?'studio':key==='selection'?'alternatives':'interventions'});
 }
 facts.push(...roofNavigatorFacts(project,scenarioId||'pending',intent));
 return facts;
}
