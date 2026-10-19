import {describe,it,expect} from 'vitest';
import {demoProject} from '../direction/productionBridge';
import {emptySurfaceContext,surfaceContextSchema} from './scientificContract';
import {productionBaseline} from './productionBaseline';
import {planningFingerprint,snapshotPlan} from './planningEngine';
import {fieldDecisionReadiness} from './fieldDecisionReadiness';
import {roofNavigatorFacts} from './navigatorRoof';
import {commitRoofRouting,roofDrainageStatus,roofPolygonFingerprint,emptyRoofRouting,invalidateRoofRouting} from './roofRouting';
import {projectV2Schema} from './projectV2';
import {confirmClassification} from './classification';
import {reshape,updateShapeData} from './authoring';
function routed(p=demoProject()){const roof={...emptySurfaceContext().roof,form:'single-slope' as const,outlet:'gutter-downpipe' as const,routing:{...emptyRoofRouting(p.zones[0]!.polygon),fall:[{from:{x:3,y:1},to:{x:3,y:7}}],outletPoint:{x:3,y:8},outletEdge:2,destinationZoneId:'z2'}};return commitRoofRouting(p,'z0',roof);}
describe('confirmed schematic roof routing',()=>{
 it('old contexts remain valid with routing absent',()=>{expect(surfaceContextSchema.parse(emptySurfaceContext()).roof.routing).toBeUndefined();expect(projectV2Schema.parse(demoProject())).toBeTruthy();});
 it('single slope needs no ridge or pitch; baseline remains identical',()=>{const p=demoProject(),n=routed(p);expect(n.science!.surfaces.z0!.roof.pitch?.value).toBeNull();expect(n.science!.surfaces.z0!.roof.routing!.ridges).toEqual([]);expect(roofDrainageStatus(n,'z0')).toBe('known');expect(productionBaseline(n,'r50')).toEqual(productionBaseline(p,'r50'));expect(projectV2Schema.parse(JSON.parse(JSON.stringify(n))).science!.surfaces.z0).toEqual(n.science!.surfaces.z0);});
 it('gable ridge is explicit and editable without changing coefficient/cost',()=>{const p=routed(),roof=structuredClone(p.science!.surfaces.z0!.roof);roof.form='gable';roof.routing!.ridges=[[{x:1,y:2},{x:5,y:2}]];const n=commitRoofRouting(p,'z0',roof);expect(n.zones).toEqual(p.zones);expect(n.parameters).toEqual(p.parameters);expect(n.science!.surfaces.z0!.roof.routing!.ridges[0]![1]).toEqual({x:5,y:2});});
 it('rejects outside ridge, invalid destination and zero direction without mutating input',()=>{const p=routed();for(const change of ['ridge','destination','fall']){const roof=structuredClone(p.science!.surfaces.z0!.roof);if(change==='ridge')roof.routing!.ridges=[[{x:100,y:100},{x:4,y:2}]];if(change==='destination')roof.routing!.destinationZoneId='missing';if(change==='fall')roof.routing!.fall=[{from:{x:2,y:2},to:{x:2,y:2}}];expect(()=>commitRoofRouting(p,'z0',roof)).toThrow();}expect(roofDrainageStatus(p,'z0')).toBe('known');});
 it('unknown destination/pitch never inferred from nearby geometry',()=>{const p=demoProject(),roof=emptySurfaceContext().roof;roof.routing=emptyRoofRouting(p.zones[0]!.polygon);const n=commitRoofRouting(p,'z0',roof);expect(roofDrainageStatus(n,'z0')).toBe('unknown');expect(n.science!.connections.find(c=>c.sourceZoneId==='z0'&&!c.candidateId)?.destination).toEqual({kind:'unknown'});});
 it('polygon edits retain geometry and mark routing unchecked selectively',()=>{const p=routed();const target=p.components.find(c=>c.targets.includes('z0'))!;target.treatment={installationZoneId:null,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:true};const poly=p.zones[0]!.polygon.map(v=>({x:v.x+.1,y:v.y}));const n=invalidateRoofRouting(p,'z0',poly);expect(n.science!.surfaces.z0!.roof.routing!.status).toBe('unchecked');expect(n.science!.surfaces.z0!.roof.routing!.outletPoint).toEqual(p.science!.surfaces.z0!.roof.routing!.outletPoint);expect(n.parameters).toEqual(p.parameters);expect(n.science!.surfaces.z0!.roof.routing!.polygonFingerprint).toBe(roofPolygonFingerprint(p.zones[0]!.polygon));expect(n.components.find(c=>c.targets.includes('z0'))?.treatment?.catchmentReviewed).toBeNull();});
 it('actual reshape invalidates even same-area movement instead of relocating outlet',()=>{const p=routed();const n=reshape(p,'z0',p.zones[0]!.polygon.map(v=>({x:v.x===0?.01:v.x,y:v.y})));expect(roofDrainageStatus(n,'z0')).toBe('stale');});
});

it('changing only pitch preserves independent source route and catchment confirmation',()=>{const p=routed(),target=p.components.find(c=>c.targets.includes('z0'))!;target.treatment={installationZoneId:null,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:true};const roof=structuredClone(p.science!.surfaces.z0!.roof);roof.pitch={value:28,unit:'degrees',origin:'user_supplied',source:'Owner declaration',method:'',date:''};const n=commitRoofRouting(p,'z0',roof);expect(n.components).toEqual(p.components);expect(n.science!.connections.filter(c=>c.candidateId)).toEqual(p.science!.connections.filter(c=>c.candidateId));});
it('a conflicting legacy connection is stale rather than confirmed in Navigator',()=>{const p=routed();p.science!.connections.find(c=>c.sourceZoneId==='z0'&&!c.candidateId)!.destination={kind:'unknown'};expect(roofDrainageStatus(p,'z0')).toBe('stale');});

it('import rejects confirmed geometry that contradicts its roof snapshot',()=>{const p=routed();p.science!.surfaces.z0!.roof.routing!.outletPoint={x:1000,y:1000};expect(projectV2Schema.safeParse(p).success).toBe(false);});
it('partial outlet context keeps unknown connection provenance',()=>{const p=demoProject(),roof=emptySurfaceContext().roof;roof.routing={...emptyRoofRouting(p.zones[0]!.polygon),destinationZoneId:'z2'};const n=commitRoofRouting(p,'z0',roof);expect(n.science!.connections.find(c=>c.sourceZoneId==='z0'&&!c.candidateId)).toMatchObject({destination:{kind:'unknown'},origin:'unknown',source:''});});

it('reclassifying a routed roof withdraws its confirmed route and dependent catchment review',()=>{
 const p=routed();
 const target=p.components.find(c=>c.targets.includes('z0'))!;
 target.treatment={installationZoneId:null,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:true};
 const zone=p.zones.find(z=>z.id==='z0')!;
 const n=confirmClassification(p,{projectId:p.id,zoneId:zone.id,zoneRevision:zone.revision},'paved',null,'reclass-paved');
 expect(n.zones.find(z=>z.id==='z0')!.surface).toBe('paved');
 expect(n.science!.surfaces.z0!.roof.routing!.status).toBe('unchecked');
 expect(n.science!.connections.find(c=>c.sourceZoneId==='z0'&&!c.candidateId)).toMatchObject({destination:{kind:'unknown'},origin:'unknown',source:''});
 expect(n.components.find(c=>c.targets.includes('z0'))!.treatment!.catchmentReviewed).toBeNull();
});

it('clearing a routed roof classification also withdraws confirmed routing',()=>{
 const p=routed();
 const z=p.zones.find(z=>z.id==='z0')!;
 const area=p.parameters.find(v=>v.id===z.area.id)!;
 const coefficient=p.parameters.find(v=>v.id===z.coefficient.id)!;
 const n=updateShapeData(p,'z0',{
  name:z.name,surface:null,method:'direct',
  area:{value:area.value,evidence:area.evidence,source:area.source,note:area.note},
  coefficient:{value:coefficient.value,evidence:coefficient.evidence,source:coefficient.source,note:coefficient.note},
  length:{value:null,evidence:'UNKNOWN',source:'',note:''},width:{value:null,evidence:'UNKNOWN',source:'',note:''},
 },()=> 'clear-surface');
 expect(n.zones.find(z=>z.id==='z0')!.surface).toBeNull();
 expect(n.science!.surfaces.z0!.roof.routing!.status).toBe('unchecked');
 expect(n.science!.connections.find(c=>c.sourceZoneId==='z0'&&!c.candidateId)).toMatchObject({destination:{kind:'unknown'},origin:'unknown'});
});

it('rejects roof-form contradictions instead of keeping stale ridge/fall geometry',()=>{
 const base=routed();
 const gable=structuredClone(base.science!.surfaces.z0!.roof);
 gable.form='gable';
 gable.routing!.ridges=[[{x:1,y:2},{x:5,y:2}]];
 const withGable=commitRoofRouting(base,'z0',gable);
 const flat=structuredClone(withGable.science!.surfaces.z0!.roof);
 flat.form='flat';
 expect(()=>commitRoofRouting(withGable,'z0',flat)).toThrow(/datar|puncak|arah/i);
 const single=structuredClone(withGable.science!.surfaces.z0!.roof);
 single.form='single-slope';
 expect(()=>commitRoofRouting(withGable,'z0',single)).toThrow(/satu arah|puncak/i);
});

it('physical roof routing does not stale a baseline-only decision without numeric change',()=>{
 let p=routed();
 const chosen=snapshotPlan(p,[], 'roof-reviewed-choice','Pilihan ditinjau');
 p={...p,selectedPlan:{definition:chosen,decisionNote:'Dipilih untuk uji stale.',reviewedInputFingerprint:planningFingerprint(p)}};
 expect(fieldDecisionReadiness(p,'r50').selected.status).not.toBe('stale');
 const roof=structuredClone(p.science!.surfaces.z0!.roof);
 roof.routing!.destinationZoneId='z3';
 const n=commitRoofRouting(p,'z0',roof);
 expect(fieldDecisionReadiness(n,'r50').selected.status).toBe('current');
});

it('roof → paved → roof never revives the old route as confirmed in Navigator',()=>{
 const p=routed();
 expect(roofNavigatorFacts(p,'r50','roof-runoff').find(f=>f.key==='roofDrainage')?.status).toBe('known');
 const roofZone=p.zones.find(z=>z.id==='z0')!;
 const paved=confirmClassification(p,{projectId:p.id,zoneId:'z0',zoneRevision:roofZone.revision},'paved',null,'cycle-paved');
 expect(roofNavigatorFacts(paved,'r50','roof-runoff')).toEqual([]);
 const pavedZone=paved.zones.find(z=>z.id==='z0')!;
 const back=confirmClassification(paved,{projectId:paved.id,zoneId:'z0',zoneRevision:pavedZone.revision},'roof',null,'cycle-roof');
 expect(back.science!.surfaces.z0!.roof.routing!.status).toBe('unchecked');
 expect(roofNavigatorFacts(back,'r50','roof-runoff').find(f=>f.key==='roofDrainage')?.status).toBe('stale');
});

it('single-slope roofs reject multiple competing fall declarations',()=>{
 const p=routed();
 const roof=structuredClone(p.science!.surfaces.z0!.roof);
 roof.form='single-slope';
 roof.routing!.fall=[{from:{x:3,y:1},to:{x:3,y:7}},{from:{x:2,y:1},to:{x:8,y:2}}];
 expect(()=>commitRoofRouting(p,'z0',roof)).toThrow(/satu arah|arah turun/i);
});

it('gable routing stays incomplete until both roof planes have fall declarations',()=>{
 const base=routed();
 const one=structuredClone(base.science!.surfaces.z0!.roof);
 one.form='gable';
 one.routing!.ridges=[[{x:1,y:2},{x:5,y:2}]];
 one.routing!.fall=[{from:{x:3,y:2},to:{x:3,y:7}}];
 const partial=commitRoofRouting(base,'z0',one);
 expect(roofDrainageStatus(partial,'z0')).toBe('unknown');
 const two=structuredClone(partial.science!.surfaces.z0!.roof);
 two.routing!.fall=[{from:{x:3,y:2},to:{x:3,y:7}},{from:{x:3,y:2},to:{x:3,y:.5}}];
 const complete=commitRoofRouting(partial,'z0',two);
 expect(roofDrainageStatus(complete,'z0')).toBe('known');
});

it('Navigator keeps a one-sided gable fall fact incomplete',()=>{
 const base=routed();
 const roof=structuredClone(base.science!.surfaces.z0!.roof);
 roof.form='gable';roof.routing!.ridges=[[{x:1,y:2},{x:5,y:2}]];roof.routing!.fall=[{from:{x:3,y:2},to:{x:3,y:7}}];
 const partial=commitRoofRouting(base,'z0',roof);
 expect(roofNavigatorFacts(partial,'r50','roof-runoff').find(f=>f.key==='roofFall')?.status).toBe('unknown');
});

it('duplicate fall declarations cannot fake gable completeness',()=>{
 const base=routed();
 const roof=structuredClone(base.science!.surfaces.z0!.roof);
 roof.form='gable';roof.routing!.ridges=[[{x:1,y:2},{x:5,y:2}]];
 const fall={from:{x:3,y:2},to:{x:3,y:7}};
 roof.routing!.fall=[fall,structuredClone(fall)];
 expect(()=>commitRoofRouting(base,'z0',roof)).toThrow(/duplikat|arah turun/i);
});

it('legacy semantic roof contradictions remain loadable but are stale for repair',()=>{
 const p=routed();
 const legacy=structuredClone(p);
 legacy.science!.surfaces.z0!.roof.form='flat';
 expect(()=>projectV2Schema.parse(legacy)).not.toThrow();
 expect(roofDrainageStatus(legacy,'z0')).toBe('stale');
});
