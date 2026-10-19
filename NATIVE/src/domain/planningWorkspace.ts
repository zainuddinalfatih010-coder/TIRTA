import type { ProjectV2 } from "./projectV2";
import { projectV2Schema } from "./projectV2";
import { writeParameter, type SourcedInput } from "./planningAuthoring";

const allocationNames = new Set(["Alokasi lahan rencana", "Ruang pemasangan yang dialokasikan", "Ruang intervensi yang dialokasikan"]);
export function planningSpaceId(project: ProjectV2): string {
  let id = "site-main", suffix = 0;
  while (true) {
    const site = project.installationSites.find(s => s.id === id);
    if (!site || (site.polygon === null && allocationNames.has(site.name))) return id;
    id = `site-planning-allowance-${++suffix}`;
  }
}
// A declared shared allowance, not a measured or technically certified location.
export function sharedPlanningSpace(project: ProjectV2): ProjectV2 {
  const p = structuredClone(project);
  const entry = { id: planningSpaceId(p), name: "Alokasi lahan rencana", availableArea: { ...p.constraints.usableArea }, suitability: "Alokasi lahan bersama yang dinyatakan pengguna untuk pra-perencanaan; kelayakan teknis lokasi belum diverifikasi.", evidence: "ASSUMPTION" as const, polygon: null };
  const existing = p.installationSites.find(site => site.id === entry.id);
  if (existing) Object.assign(existing, entry); else p.installationSites.push(entry);
  return p;
}

export function savePlanningLimits(project: ProjectV2, budget: SourcedInput, land: SourcedInput): ProjectV2 {
  const p = structuredClone(project);
  p.constraints.budget = writeParameter(p, p.constraints.budget.id, "IDR", budget);
  p.constraints.usableArea = writeParameter(p, p.constraints.usableArea.id, "m2", land);
  return projectV2Schema.parse(sharedPlanningSpace(p));
}
