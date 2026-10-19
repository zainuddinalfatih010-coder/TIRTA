import { projectSchema } from "./model";
import { createProjectV2, projectV2Schema, type ProjectV2 } from "./projectV2";
import { initializeScience } from "./scientificAuthoring";
import { routingIssues } from "./sourceRouting";
import { legacyPlanningFingerprint, planningFingerprint } from './planningEngine';

/** Pure migration. Caller retains the original payload and commits only after validation. */
export function migrateProject(input: unknown, now: string): ProjectV2 {
  if (
    typeof input !== "object" ||
    input === null ||
    !("schemaVersion" in input)
  )
    throw new Error("INVALID_SCHEMA: format proyek tidak dikenal.");
  if (input.schemaVersion === 2) {
    const p = initializeScience(projectV2Schema.parse(input));
    const issues = routingIssues(p,{allowSemanticRoofStale:true});
    if (issues.length) throw new Error(issues.join(' '));
    // Semantic identity upgrade only: preserve all evidence and already-stale decisions.
    const previous=legacyPlanningFingerprint(p);
    if(p.selectedPlan?.reviewedInputFingerprint===previous) {
      const next=structuredClone(p);
      next.selectedPlan!.reviewedInputFingerprint=planningFingerprint(next);
      return next;
    }
    return p;
  }
  if (input.schemaVersion !== 1)
    throw new Error(
      "UNSUPPORTED_VERSION: gunakan versi aplikasi yang mendukung berkas ini.",
    );
  const old = projectSchema.parse(input),
    fresh = createProjectV2(old.id, old.name, now);
  const used = new Set(old.parameters.map((x) => x.id));
  const unique = (base: string) => {
    let id = base;
    while (used.has(id)) id += "-new";
    used.add(id);
    return id;
  };
  const budget = { ...fresh.parameters[0]!, id: unique("budget") },
    usable = { ...fresh.parameters[1]!, id: unique("usable-area") };
  return initializeScience(projectV2Schema.parse({
    ...fresh,
    mode: old.mode,
    parcel: old.parcel
      ? {
          ...old.parcel,
          id: "parcel",
          geometryContext: "schematic",
          areaMethod: { kind: "direct" },
        }
      : null,
    parameters: [
      ...old.parameters.map((p) => ({ ...p, revision: 1, applicability: "" })),
      budget,
      usable,
    ],
    zones: old.zones.map((z) => ({
      ...z,
      revision: 1,
      classificationRecordId: null,
      areaMethod: { kind: "direct" },
    })),
    scenarios: old.scenarios.map((s) => ({
      ...s,
      revision: 1,
      eventWindowNote: "",
      overrides: [],
    })),
    constraints: {
      ...fresh.constraints,
      budget: { id: budget.id, unit: budget.unit, evidence: budget.evidence },
      usableArea: {
        id: usable.id,
        unit: usable.unit,
        evidence: usable.evidence,
      },
    },
  }));
}
