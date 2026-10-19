import type {ProjectV2} from '../domain/projectV2';
import {planningFingerprint,type Alternative} from '../domain/planningEngine';
import {assessPackage} from '../domain/packageRecommendations';
import {addTreatment,bioporiInstallationAllowed} from '../domain/treatmentDesign';
import {projectV2Schema} from '../domain/projectV2';
export type RecommendationPriority='residual'|'cost'|'area';
export type RecommendationMethod='tank'|'soak'|'garden'|'biopori';
export const recommendationMethods={tank:{name:'Tangki',family:'storage',claim:'CLAIM-STORAGE'},soak:{name:'Sumur / area resapan',family:'infiltration',claim:'CLAIM-SOIL'},garden:{name:'Rain garden',family:'rain-garden',claim:'CLAIM-BIO-MEDIA'},biopori:{name:'Biopori',family:'infiltration',claim:'CLAIM-BIOPORI'}} as const;
/** Explicit single criterion, with equal results retained. Never guesses missing engineering inputs. */
export function guidedCandidates(project:ProjectV2,alternatives:readonly Alternative[],scenario:string,priority:RecommendationPriority){
 const valid=alternatives.filter(a=>a.plan.components.some(c=>c.enabled)&&assessPackage(project,a.plan,scenario).status!=='blocked');
 if(!valid.length)return [];
 const minimum=Math.min(...valid.map(a=>a.balance[priority]));
 return valid.filter(a=>Math.abs(a.balance[priority]-minimum)<=1e-9*Math.max(1,minimum));
}
export function prepareGuidedDraft(project:ProjectV2,scenario:string,request:{fingerprint:string;sourceId:string;siteId:string;method:RecommendationMethod}){
 if(planningFingerprint(project)!==request.fingerprint)throw new Error('Data berubah. Periksa rekomendasi kembali.');
 if(!project.scenarios.some(s=>s.id===scenario))throw new Error('Pilih skenario hujan yang tersedia.');
 const source=project.zones.find(z=>z.id===request.sourceId);
 if(!source)throw new Error('Pilih zona sumber air yang tersedia.');
 const site=project.zones.find(z=>z.id===request.siteId);
 if(!site)throw new Error('Pilih lokasi pemasangan.');
 if(request.method==='biopori'&&!bioporiInstallationAllowed(site.surface))throw new Error('Biopori tidak dapat dipasang pada Atap. Pilih lokasi non-atap.');
 const next=addTreatment(project,recommendationMethods[request.method].family,scenario,request.sourceId,request.method==='biopori');
 const component=next.project.components.find(c=>c.id===next.id)!;
 component.treatment!.installationZoneId=site.id;
 // This is a schematic location, not proof of a connection or infiltration capacity.
 return {project:projectV2Schema.parse(next.project),id:next.id};
}
