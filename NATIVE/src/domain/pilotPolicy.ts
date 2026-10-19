import type {ProjectV2} from './projectV2';
import type {Plan} from './planningEngine';

/** Current product retirement: permeable conversion is kept only for legacy compatibility. */
export const pilotRetirementReason='Permukaan berpori tidak lagi menjadi intervensi aktif; record lama tetap dapat dibaca.';
export const retiredPilotPlan=(plan:Plan)=>plan.components.some(c=>c.enabled&&c.family==='permeable');

/** Current search excludes retired permeable conversion without mutating the authoritative project or frozen history. */
export function pilotSearchProject(project:ProjectV2):ProjectV2 {
 const next=structuredClone(project);
 const retiredIds=new Set(next.components.filter(c=>c.family==='permeable').map(c=>c.id));
 next.components=next.components.map(c=>c.family==='permeable'?{...c,enabled:false}:c);
 next.optionGroups=next.optionGroups.map(group=>group.choices.some(choice=>choice.componentIds.some(id=>retiredIds.has(id)))?{...group,enabled:false}:group);
 next.manualPlans=next.manualPlans.filter(plan=>!retiredPilotPlan(plan));
 return next;
}
