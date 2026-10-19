import type {ProjectV2} from './projectV2';
import {evaluatePlan,type Plan} from './planningEngine';
import {productionBaseline} from './productionBaseline';
import {assessIntervention} from './feasibility';
import {routeForSource,sourceConnects} from './sourceRouting';

export type PlanCheck={id:string;componentId:string;field:string;label:string;message:string;action:string};
const checkFields:Record<string,{field:string;label:string;action:string}>={
 CONNECTION:{field:'connection',label:'Jalur air & luapan',action:'Periksa jalur air'},
 PERFORMANCE:{field:'capacityBasis',label:'Dasar kapasitas',action:'Tinjau dasar kapasitas'},
 CAPACITY:{field:'operation',label:'Penggunaan tangki',action:'Tinjau penggunaan'},
 SOIL:{field:'soil',label:'Resapan tanah',action:'Periksa lokasi'},
 GROUNDWATER:{field:'groundwater',label:'Kondisi air tanah',action:'Catat hasil pemeriksaan'},
 BIOPORI_SITE:{field:'installation',label:'Lokasi biopori',action:'Periksa lokasi'},
 RESOURCE:{field:'cost',label:'Biaya & lahan',action:'Periksa angka'},
 STANDARD:{field:'standard',label:'Persyaratan setempat',action:'Tinjau persyaratan'},
 MEDIA:{field:'media',label:'Media & tanaman',action:'Tinjau media'},
 MAINTENANCE:{field:'maintenance',label:'Pemeliharaan',action:'Tinjau pemeliharaan'},
 FIELD:{field:'field',label:'Pemeriksaan lokasi',action:'Catat pemeriksaan'},
};
/** Reuses the screening rules. Counts distinct actions, never certifies installation. */
export function planImplementationChecks(project:ProjectV2,plan:Plan,scenario:string):PlanCheck[]{
 const components=plan.components.filter(c=>c.enabled);
 const parameters=[...project.parameters.filter(p=>!plan.parameters.some(v=>v.id===p.id)),...plan.parameters];
 const priority=['BIOPORI_SITE','CONNECTION','PERFORMANCE','SOIL','GROUNDWATER','CAPACITY','RESOURCE','STANDARD','MAINTENANCE','MEDIA','FIELD'];
 const findings=components.flatMap(c=>{const a=assessIntervention(project,c,scenario,parameters,plan.scientificEvidence?.[c.id],true,components);return [a.reasons,a.missing,a.conditions].flatMap((items,severity)=>items.map(f=>({c,f,severity})));});
 findings.sort((a,b)=>a.severity-b.severity||priority.indexOf(a.f.ruleId)-priority.indexOf(b.f.ruleId)||a.c.id.localeCompare(b.c.id));
 const seen=new Set<string>();
 return findings.flatMap(({c,f})=>{const item=checkFields[f.ruleId]??{field:f.field??'field',label:'Pemeriksaan penerapan',action:'Tinjau data'};const field=f.field??item.field,id=`${c.id}:${field}`;if(seen.has(id))return [];seen.add(id);return [{...item,id,componentId:c.id,field,message:`${c.name}: ${f.message.replace(/\bUNKNOWN\b/g,'belum diketahui')}`}];});
}

export function planScenarioOutcomes(project:ProjectV2,plan:Plan){
 return project.scenarios.map(s=>{
  const evaluated=evaluatePlan(project,plan,s.id),baseline=productionBaseline(project,s.id);
  if(!evaluated.ok||!baseline.ok)return {id:s.id,name:s.name,ok:false as const,reasons:[...(!evaluated.ok?evaluated.issues.map(i=>i.message):[]),...(!baseline.ok?baseline.issues.map(i=>i.message):[])]};
  const handled=baseline.value.runoffM3-evaluated.value.residual;
  return {id:s.id,name:s.name,ok:true as const,rain:baseline.value.rainfallMm,baseline:baseline.value.runoffM3,residual:evaluated.value.residual,handled,percent:baseline.value.runoffM3>0?handled/baseline.value.runoffM3*100:null};
 });
}

const viaLabels={'gutter-downpipe':'Talang / pipa turun',edge:'Tepi atap',drain:'Saluran',other:'Jalur lain',unknown:'Jalur belum diperiksa'};
/** Only follows declared links for this selected definition, never symbol proximity. */
export function planDeclaredPaths(project:ProjectV2,plan:Plan){
 const components=plan.components.filter(c=>c.enabled),context={componentIds:components.map(c=>c.id)};
 return components.map(c=>({id:c.id,name:c.name,paths:c.targets.map(id=>{
  const route=routeForSource(project,id,c.id);
  const connected=sourceConnects(project,id,c.id,context);
  return {source:project.zones.find(z=>z.id===id)?.name??'Zona sumber tidak tersedia',connected,
   steps:route.flatMap(link=>{const destination=link.destination;return [viaLabels[link.via],...(destination.kind==='zone'?[project.zones.find(z=>z.id===destination.id)?.name??'Zona tidak tersedia']:[])];})};
 }),overflow:(()=>{const destination=project.science?.interventions[c.id]?.overflow;
  if(!destination||destination.kind==='unknown')return 'Tujuan luapan · belum diperiksa';
  if(destination.kind==='zone')return `Luapan → ${project.zones.find(z=>z.id===destination.id)?.name??'zona tidak tersedia'}`;
  if(destination.kind==='intervention')return `Luapan → ${components.find(v=>v.id===destination.id)?.name??'penanganan tidak tersedia dalam paket'}`;
  return destination.kind==='drainage'?'Luapan → saluran (dinyatakan pengguna)':'Luapan → keluar persil (dinyatakan pengguna)';
 })()}));
}
