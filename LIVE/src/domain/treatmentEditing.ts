import type { ProjectV2 } from './projectV2';
import { projectV2Schema } from './projectV2';
import type { ComponentVariant } from './intervention-contract';
import { addTreatment } from './treatmentDesign';
import { planningFingerprint, planningParameterValue } from './planningEngine';
import { clearInactiveDestinations } from './treatmentLifecycle';
import { readInput } from './planningAuthoring';
import { savePlanningLimits } from './planningWorkspace';

/** Session-only working copy. Never passed to persistence, optimizer or resource totals. */
export type TreatmentEdit = { project: ProjectV2; id: string; scenarioId: string; baseFingerprint: string; fresh: boolean };
export function exploreTreatment(p: ProjectV2, family: ComponentVariant['family'], scenarioId: string, sourceId?: string, biopori = false): TreatmentEdit {
  const added = addTreatment(p, family, scenarioId, sourceId, biopori);
  return { ...added, scenarioId, baseFingerprint: planningFingerprint(p), fresh: true };
}
export function editTreatment(p: ProjectV2, id: string, scenarioId: string): TreatmentEdit {
  if (!p.components.some(c => c.id === id)) throw new Error('Penanganan tidak tersedia.');
  return { project: structuredClone(p), id, scenarioId, baseFingerprint: planningFingerprint(p), fresh: false };
}
export function rebaseTreatmentEditLimits(current: ProjectV2, edit: TreatmentEdit, next: ProjectV2): TreatmentEdit {
  if (current.id !== edit.project.id || next.id !== current.id || planningFingerprint(current) !== edit.baseFingerprint)
    throw new Error('Data proyek berubah selama penyuntingan. Batalkan isian ini lalu buka penanganan kembali; perubahan proyek tetap tersimpan.');
  const project = savePlanningLimits(edit.project, readInput(next, next.constraints.budget), readInput(next, next.constraints.usableArea));
  return { ...edit, project, baseFingerprint: planningFingerprint(next) };
}
/** Explicit commit rejects concurrent upstream edits instead of overwriting them. */
export function commitTreatmentEdit(current: ProjectV2, edit: TreatmentEdit, edited: ProjectV2): ProjectV2 {
  if (current.id !== edit.project.id || edited.id !== current.id || planningFingerprint(current) !== edit.baseFingerprint)
    throw new Error('Data proyek berubah selama penyuntingan. Batalkan isian ini lalu buka penanganan kembali; perubahan proyek tetap tersimpan.');
  if (!edited.components.some(c => c.id === edit.id)) throw new Error('Penanganan tidak tersedia.');
  return projectV2Schema.parse({ ...current, parameters: edited.parameters, constraints: edited.constraints, components: edited.components, optionGroups: edited.optionGroups, installationSites: edited.installationSites, science: edited.science ? {...edited.science,observations:current.science?.observations ?? []} : edited.science });
}
export type ResourceKnowledge = { known: number; unknown: number; total: number | null };
export type PackageResources = { cost: ResourceKnowledge; area: ResourceKnowledge };
export function packageResources(p: ProjectV2): PackageResources {
  const sum = (field: 'totalCost' | 'occupiedArea', unit: 'IDR' | 'm2'): ResourceKnowledge => {
    let known = 0, unknown = 0;
    for (const c of p.components.filter(c => c.enabled && c.family !== 'permeable')) {
      try { known += planningParameterValue(p.parameters, c[field], unit, c.name); }
      catch { unknown++; }
    }
    return { known, unknown, total: unknown ? null : known };
  };
  return { cost: sum('totalCost', 'IDR'), area: sum('occupiedArea', 'm2') };
}
/** Removes current declarations and links; frozen plan definitions remain immutable. */
export function deleteTreatment(p: ProjectV2, id: string): ProjectV2 {
  if (!p.components.some(c => c.id === id)) throw new Error('Penanganan tidak tersedia.');
  const next = structuredClone(p);
  next.components = next.components.filter(c => c.id !== id).map(c => ({ ...c, excludes: c.excludes.filter(other => other !== id) }));
  next.optionGroups = next.optionGroups.map(g => ({ ...g, choices: g.choices.flatMap(choice => {
    const componentIds = choice.componentIds.filter(other => other !== id);
    return choice.componentIds.length && !componentIds.length ? [] : [{ ...choice, componentIds }];
  }) })).filter(g => g.choices.some(choice => choice.componentIds.length));
  if (next.science) {
    delete next.science.interventions[id];
    next.science.connections = next.science.connections.filter(c => c.candidateId !== id);
    next.science.legacyNeedsVerification = next.science.legacyNeedsVerification.filter(key => key !== id);
  }
  // Preserve numeric/history records: frozen plans may still reference their original parameters.
  return clearInactiveDestinations(next);
}
