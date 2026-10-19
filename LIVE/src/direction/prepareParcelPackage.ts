import type { ProjectV2 } from "../domain/projectV2";
import { projectV2Schema } from "../domain/projectV2";
import { emptyInput, readInput, saveComponent } from "../domain/planningAuthoring";
import { planningSpaceId, sharedPlanningSpace } from "../domain/planningWorkspace";
import type { PackageTemplate } from "../domain/packageRecommendations";
import { options, setActiveComponents } from "./productionBridge";
import { emptyInterventionEvidence } from '../domain/scientificContract';

export function prepareParcelPackage(project: ProjectV2, template: PackageTemplate, scenario: string): ProjectV2 {
  if (template.options.some(o=>o.family === 'permeable')) throw new Error('Opsi berpori tidak aktif untuk pilot ini.');
  const active = template.options.map(choice => options.find(o => o.domainFamily === choice.family)!.id);
  let next = sharedPlanningSpace(setActiveComponents(project, active));
  for (const choice of template.options) {
    const id = options.find(o => o.domainFamily === choice.family)!.id;
    const old = project.components.find(c => c.id === id);
    const same = old && JSON.stringify(old.targets) === JSON.stringify(choice.targets)
      && (old.family !== "infiltration" || (old.infiltrationType ?? "well") === (choice.biopori ? "biopori" : "well"));
    const perf = old?.performanceByScenario[scenario];
    const capacity = perf && ("availableStorage" in perf ? perf.availableStorage : "infiltrationCapacity" in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
    next = saveComponent(next, {
      id, family: choice.family, name: choice.biopori ? "Biopori" : options.find(o => o.id === id)!.name,
      targets: choice.targets, siteId: old?.installationSiteId || planningSpaceId(next),
      connection: "Sumber air dipilih pengguna melalui rancangan paket. Penyaluran ke lokasi pemasangan perlu dirancang dan diperiksa; tidak berasal dari kedekatan pada gambar.",
      applicability: same ? (perf?.applicability ?? "") : "Rancangan paket dikonfirmasi pengguna; kapasitas untuk hujan ini belum diketahui sampai dinyatakan dengan sumber.",
      cost: same ? readInput(project, old.totalCost) : emptyInput(),
      area: same ? readInput(project, old.occupiedArea) : emptyInput(),
      capacity: same ? readInput(project, capacity, scenario) : emptyInput(),
      scenarioId: scenario,
      reuse: same && perf && "reuse" in perf && perf.reuse.mode === "capture-then-reuse" ? readInput(project, perf.reuse.demand, scenario) : null,
      infiltrationType: choice.family === "infiltration" ? (choice.biopori ? "biopori" : "well") : undefined,
      siteAssessment: old?.siteAssessment ?? { connection: "unknown", infiltration: "unknown", plantingSpace: "unknown", surfaceChange: "unknown", source: "" },
    });
    if (!same) {
      const c = next.components.find(c => c.id === id)!;
      for (const id of Object.keys(c.performanceByScenario)) if (id !== scenario) delete c.performanceByScenario[id];
      if (c.family === "storage") { c.waterUse = "unknown"; c.drawdown = "unknown"; }
      if (c.family === "rain-garden") c.plantingPlan = "unknown";
      c.planningNotes = "";
      if (next.science) {
        next.science.interventions[id] = emptyInterventionEvidence();
        next.science.connections = next.science.connections.filter(link=>link.candidateId !== id);
      }
      if (c.treatment) c.treatment = { ...c.treatment, catchmentReviewed: null, sharedSourceMode: 'unresolved', allocationNote: '' };
    }
  }
  return projectV2Schema.parse(next);
}
