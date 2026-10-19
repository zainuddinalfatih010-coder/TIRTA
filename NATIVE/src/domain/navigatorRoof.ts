import type {ProjectV2} from './projectV2';
import {navigatorFactId,navigatorFactRegistry,type NavigatorFact,type NavigatorFactKey,type NavigatorIntent} from './navigatorFacts';
import {roofDrainageStatus} from './roofRouting';
export function roofNavigatorFacts(p:ProjectV2,sid:string,intent:NavigatorIntent):NavigatorFact[]{
 return p.zones.filter(z=>z.surface==='roof'&&(intent==='roof-runoff'||intent==='storage'||p.components.some(c=>c.enabled&&c.targets.includes(z.id)))).flatMap(z=>{
 const roof=p.science?.surfaces[z.id]?.roof,r=roof?.routing,status=roofDrainageStatus(p,z.id);
 const fallKnown=!!r&&(roof?.form==='gable'?r.fall.length>=2:r.fall.length>0);
 const declarations:[NavigatorFactKey,boolean,boolean][]=[['roofForm',!!roof&&roof.form!=='unknown',status==='known'],['roofRidge',!!r?.ridges.length,true],['roofFall',fallKnown,status==='known'||roof?.form==='flat'||roof?.form==='mixed'],['roofPitch',roof?.pitch?.value!==null&&roof?.pitch?.value!==undefined,true],['roofOutlet',!!roof&&roof.outlet!=='unknown',false],['roofOutletEdge',!!r?.outletPoint,false],['roofDestination',!!r?.destinationZoneId,false],['roofDrainage',status==='known',false]];
 return declarations.map(([key,known,optional]):NavigatorFact=>({id:navigatorFactId('zone',z.id,sid,key),key,scope:'zone',objectId:z.id,zoneId:z.id,scenarioId:sid,group:'connection',status:status==='stale'&&key!=='roofPitch'?'stale':known?'known':'unknown',optional,label:key==='roofDrainage'?`Atur aliran ${z.name}`:navigatorFactRegistry[key].label,valueLabel:known?'Dikonfirmasi':'Belum diketahui',why:status==='stale'?'Aliran atap perlu ditinjau ulang. Konfirmasi kembali aliran.':'Volume limpasan dapat dihitung dari luas, C, dan hujan. Tujuan aliran atap perlu dikonfirmasi terpisah.',consequence:'water',blockingOutput:'water',dependencies:[],destination:'studio',fingerprint:JSON.stringify([key,status==='stale'?status:known,key==='roofPitch'?roof?.pitch:key==='roofForm'?roof?.form:key==='roofRidge'?r?.ridges:key==='roofFall'?r?.fall:key==='roofOutlet'?roof?.outlet:key==='roofOutletEdge'?[r?.outletPoint,r?.outletEdge]:key==='roofDestination'?r?.destinationZoneId:[r,roof?.form,roof?.outlet]])}));
 });
}
