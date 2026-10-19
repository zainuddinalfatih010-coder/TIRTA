import type { ProjectV2 } from './projectV2';
import { treatmentRequirements } from './productState';
import { fieldDecisionReadiness } from './fieldDecisionReadiness';
import { navigatorFactId, navigatorFactRegistry, type NavigatorFact, type NavigatorFactKey } from './navigatorFacts';

export function interventionNextActions(project: ProjectV2, componentId: string, scenarioId: string) {
 return fieldDecisionReadiness(project,scenarioId).treatments.find(c=>c.id===componentId)?.actions ?? [];
}
/** Presentation adapter only. Eligibility remains owned by the canonical validators. */
export function interventionNavigatorFacts(project: ProjectV2, componentId: string, scenarioId: string): NavigatorFact[] {
 const c=project.components.find(item=>item.id===componentId);
 if(!c || !project.scenarios.some(s=>s.id===scenarioId))return [];
 const actions=interventionNextActions(project,componentId,scenarioId);
 return treatmentRequirements(project,c,scenarioId).flatMap(section=>section.rows.flatMap(row=>{
  if(!Object.hasOwn(navigatorFactRegistry,row.field))return [];
  const key=row.field as NavigatorFactKey, metadata=navigatorFactRegistry[key];
  const action=actions.find(a=>a.field===key);
  const status=action?.severity==='stale'?'stale':action?.severity==='incompatible'?'invalid':row.status==='missing'?'unknown':row.status;
  return [{id:navigatorFactId('treatment',c.id,scenarioId,key),key,scope:'treatment' as const,objectId:c.id,scenarioId,
   zoneId:c.treatment?.installationZoneId??undefined,group:section.id,status,valueLabel:row.value,label:row.label,
   consequence:row.consequence,why:row.why,
   dependencies:metadata.branchDependency?[navigatorFactId('treatment',c.id,scenarioId,metadata.branchDependency)]:[],
   blockingOutput:row.consequence,destination:metadata.destination,
   fingerprint:JSON.stringify([row.value,status]),
  } satisfies NavigatorFact];
 }));
}
