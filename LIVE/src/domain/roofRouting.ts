import {roofGeometryIssues} from './roofGeometry';
import type {Point} from './model';
import type {ProjectV2} from './projectV2';
import {emptySurfaceContext,surfaceContextSchema,type SurfaceContext} from './scientificContract';
import {updateScience} from './scientificAuthoring';
export type Roof=SurfaceContext['roof'];
export type RoofRouting=NonNullable<Roof['routing']>;
export const roofRoutingMeaning=(roof:Roof|undefined)=>JSON.stringify(roof?{form:roof.form,outlet:roof.outlet,ridges:roof.routing?.ridges,fall:roof.routing?.fall,outletPoint:roof.routing?.outletPoint,outletEdge:roof.routing?.outletEdge,destinationZoneId:roof.routing?.destinationZoneId}:null);
export const roofPolygonFingerprint=(points:Point[])=>JSON.stringify(points);
export const emptyRoofRouting=(polygon:Point[]):RoofRouting=>({ridges:[],fall:[],outletPoint:null,outletEdge:null,destinationZoneId:null,polygonFingerprint:roofPolygonFingerprint(polygon),status:'unchecked'});
export function roofDrainageStatus(p:ProjectV2,id:string):'known'|'unknown'|'stale'{
 const z=p.zones.find(z=>z.id===id),roof=p.science?.surfaces[id]?.roof,r=roof?.routing;
 if(!z||z.surface!=='roof'||!r)return 'unknown';
 if(r.status!=='confirmed'||r.polygonFingerprint!==roofPolygonFingerprint(z.polygon)||r.destinationZoneId&&!p.zones.some(z=>z.id===r.destinationZoneId))return 'stale';
 if(roofGeometryIssues(z.polygon,r,roof.form).length)return 'stale';
 const link=p.science?.connections.find(c=>c.sourceZoneId===id&&!c.candidateId);if(r.destinationZoneId&&r.outletPoint&&roof!.outlet!=='unknown'&&(!link||link.destination.kind!=='zone'||link.destination.id!==r.destinationZoneId||link.origin==='unknown'||!link.source.trim()))return 'stale';
 const directionReady=roof!.form==='flat'||roof!.form==='mixed'||roof!.form==='gable'?(roof!.form==='gable'?r.ridges.length>0&&r.fall.length>=2:true):r.fall.length>0;
 return roof!.outlet!=='unknown'&&!!r.outletPoint&&!!r.destinationZoneId&&directionReady?'known':'unknown';
}
/** Preserve declarations, withdraw only source-route/catchment confirmation. No quantity writes. */
export function invalidateRoofRouting(p:ProjectV2,id:string,polygon?:Point[]):ProjectV2{
 const r=p.science?.surfaces[id]?.roof.routing;
 if(!r||polygon&&r.polygonFingerprint===roofPolygonFingerprint(polygon))return p;
 const n=structuredClone(p);n.science!.surfaces[id]!.roof.routing!.status='unchecked';
 n.science!.connections=n.science!.connections.map(c=>c.sourceZoneId===id?{...c,destination:{kind:'unknown'},origin:'unknown',source:''}:c);
 n.components=n.components.map(c=>c.targets.includes(id)&&c.treatment?{...c,revision:c.revision+1,treatment:{...c.treatment,catchmentReviewed:null}}:c);
 return n;
}
export function commitRoofRouting(p:ProjectV2,id:string,input:Roof):ProjectV2{
 const z=p.zones.find(z=>z.id===id);if(z?.surface!=='roof')throw new Error('Pilih zona Atap.');
 const context=structuredClone(p.science?.surfaces[id]??emptySurfaceContext());context.roof=input;const roof=surfaceContextSchema.parse(context).roof,r=roof.routing;
 if(!r)throw new Error('Pratinjau aliran belum tersedia.');
 const geometryIssues=roofGeometryIssues(z.polygon,r,roof.form);if(geometryIssues.length)throw new Error(geometryIssues.join(' '));
 if(r.destinationZoneId&&(r.destinationZoneId===id||!p.zones.some(z=>z.id===r.destinationZoneId)))throw new Error('Pilih zona penerima yang tersedia.');
 const changed=roofRoutingMeaning(p.science?.surfaces[id]?.roof)!==roofRoutingMeaning(roof);
 const base=changed?invalidateRoofRouting(p,id):p;
 return updateScience(base,s=>{context.roof={...roof,routing:{...r,polygonFingerprint:roofPolygonFingerprint(z.polygon),status:'confirmed'}};s.surfaces[id]=context;
 s.connections=s.connections.filter(c=>c.sourceZoneId!==id||c.candidateId);
 s.connections.push({id:`existing-${id}`,sourceZoneId:id,destination:r.destinationZoneId&&roof.outlet!=='unknown'&&r.outletPoint?{kind:'zone',id:r.destinationZoneId}:{kind:'unknown'},via:roof.outlet==='gutter-downpipe'?'gutter-downpipe':roof.outlet==='edge'||roof.outlet==='drain'?roof.outlet:'unknown',origin:r.destinationZoneId&&roof.outlet!=='unknown'&&r.outletPoint?'user_supplied':'unknown',source:r.destinationZoneId&&roof.outlet!=='unknown'&&r.outletPoint?'Dikonfirmasi pengguna melalui Studio Atap':''});});
}
export function nearestRoofEdge(polygon:Point[],point:Point){
 return polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length]!,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:Math.round((a.x+t*dx)*1000)/1000,y:Math.round((a.y+t*dy)*1000)/1000};return {index:i,point:q,distance:Math.hypot(q.x-point.x,q.y-point.y)};}).sort((a,b)=>a.distance-b.distance)[0]!;
}
