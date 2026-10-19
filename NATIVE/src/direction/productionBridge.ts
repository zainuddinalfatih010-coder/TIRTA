import { declareDemonstrationScience } from './demonstrationScience';
import { clearInactiveDestinations } from '../domain/treatmentLifecycle';
import { pilotSearchProject } from '../domain/pilotPolicy';
import { deriveEditedAreas } from "../domain/scaledAreas";
import { z } from "zod";
import { polygonArea } from "../domain/geometry";
import type { Point } from "../domain/model";
import type { Surface } from "../domain/model";
import { addShape, updateShapeData } from "../domain/authoring";
import { createProjectV2, projectV2Schema, type ProjectV2 } from "../domain/projectV2";
import {
  readInput,
  saveComponent,
  saveRain,
  writeParameter,
  type SourcedInput,
} from "../domain/planningAuthoring";
import {
  evaluatePlan,
  optimize,
  snapshotPlan,
  type PlanBalance,
} from "../domain/planningEngine";
import { productionBaseline } from "../domain/productionBaseline";
export const fmt = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
export const money = (value: number) =>
  value !== 0 && Math.abs(value) < 1_000_000
    ? `Rp${new Intl.NumberFormat("id-ID", { maximumSignificantDigits: 21 }).format(value)}`
    : `Rp${fmt(value / 1_000_000)} jt`;
export const source =
  "Data demo sintetis untuk eksplorasi; bukan pengukuran sekolah nyata.";
export { coefficientGuidance } from "../domain/coefficientGuidance";
const known = (value: number, origin = source): SourcedInput => ({
  text: String(value),
  evidence: "DEMO",
  source: origin,
});
const unknownInput = (): SourcedInput => ({
  text: "",
  evidence: "UNKNOWN",
  source: "",
});
const valueOf = (
  project: ProjectV2,
  ref: { id: string },
): number | null => project.parameters.find((p) => p.id === ref.id)?.value ?? null;
const shapeInput = (
  name: string,
  surface: Surface | null,
  area: number,
  coefficient: number | null,
) => ({
  name,
  surface,
  area: {
    value: area,
    evidence: "DEMO" as const,
    source,
    note: "Luas demo cocok dengan geometri contoh berskala meter.",
  },
  coefficient: {
    value: coefficient,
    evidence: coefficient === null ? ("UNKNOWN" as const) : ("DEMO" as const),
    source: coefficient === null ? "" : source,
    note: coefficient === null ? "" : "Koefisien demo; bukan autofill kelas.",
  },
  method: "direct" as const,
  length: { value: null, evidence: "UNKNOWN" as const, source: "", note: "" },
  width: { value: null, evidence: "UNKNOWN" as const, source: "", note: "" },
});
export function demoProject(complete = true, uncertainty = false): ProjectV2 {
  let p = createProjectV2("friday-demo", "Sekolah Taman Sari", new Date().toISOString());
  p.mode = "demo";
  p = addShape(
    p,
    "parcel",
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ],
    true,
  );
  p = updateShapeData(p, "parcel", shapeInput("", null, 200, null), () => crypto.randomUUID());
  const zones: Array<{
    id: string;
    name: string;
    surface: Surface;
    polygon: Point[];
    coefficient: number | null;
  }> = [
    { id: "z0", name: "Gedung belajar", surface: "roof", coefficient: 0.85, polygon: [[0,0],[10,0],[10,3],[6,3],[6,8],[0,8]].map(([x,y]) => ({x:x!,y:y!})) },
    { id: "z1", name: "Halaman kegiatan", surface: "paved", coefficient: 0.9, polygon: [[6,3],[14,3],[14,8],[20,8],[20,10],[6,10]].map(([x,y]) => ({x:x!,y:y!})) },
    { id: "z2", name: "Tanah timur", surface: "soil", coefficient: complete ? 0.2 : null, polygon: [[14,3],[20,3],[20,8],[14,8]].map(([x,y]) => ({x:x!,y:y!})) },
    { id: "z3", name: "Taman", surface: "vegetation", coefficient: 0.12, polygon: [[10,0],[20,0],[20,3],[10,3]].map(([x,y]) => ({x:x!,y:y!})) },
    { id: "z4", name: "Paving berpori", surface: "porous", coefficient: 0.3, polygon: [[0,8],[6,8],[6,10],[0,10]].map(([x,y]) => ({x:x!,y:y!})) },
  ];
  for (const z of zones) {
    p = addShape(p, z.id, z.polygon);
    p = updateShapeData(
      p,
      z.id,
      shapeInput(z.name, z.surface, polygonArea(z.polygon), z.coefficient),
      () => crypto.randomUUID(),
    );
  }
  p = saveRain(p, "r50", "Hujan 50 mm", known(50), "Satu kejadian demo.");
  p = saveRain(p, "r100", "Hujan 100 mm", known(100), "Satu kejadian demo pembanding.");
  const budgetRef = writeParameter(p, p.constraints.budget.id, "IDR", known(12_000_000));
  const landRef = writeParameter(p, p.constraints.usableArea.id, "m2", known(24));
  p.constraints = {
    ...p.constraints,
    budget: budgetRef,
    usableArea: landRef,
  };
  const siteArea = writeParameter(p, "site-main-area", "m2", known(24));
  p.installationSites = [
    {
      id: "site-main",
      name: "Ruang intervensi yang dialokasikan",
      availableArea: siteArea,
      suitability: "Asumsi demo yang dinyatakan pengguna; bukan kajian geoteknik.",
      evidence: "DEMO",
      polygon: null,
    },
  ];
  const definitions = [
    { id: "tank", name: "Tangki atap", family: "storage" as const, target: "z0", cost: 3_000_000, area: 2, capacity: 3.5 },
    { id: "soak", name: "Sumur / area resapan", family: "infiltration" as const, target: "z2", cost: 2_500_000, area: 4, capacity: 2.5 },
    { id: "garden", name: "Rain garden halaman", family: "rain-garden" as const, target: "z1", cost: 3_000_000, area: 6, capacity: 3 },
    { id: "porous", name: "Permukaan berpori", family: "permeable" as const, target: "z1", cost: 2_000_000, area: 8, capacity: 2 },
  ];
  for (const d of definitions) {
    for (const scenarioId of ["r50", "r100"]) {
      p = saveComponent(p, {
        id: d.id,
        name: d.name,
        family: d.family,
        targets: [d.target],
        siteId: "site-main",
        connection: "Target dipilih pengguna pada zona yang dinyatakan.",
        applicability: "Kapasitas demo per kejadian; perlu verifikasi teknis sebelum desain.",
        cost: known(d.cost),
        area: known(d.area),
        scenarioId,
        capacity: known(d.capacity),
        reuse: null,
      });
    }
  }
  p.optionGroups = definitions.map((d) => ({
    id: `choice-${d.id}`,
    name: d.name,
    enabled: true,
    choices: [
      { id: "off", name: "Tidak dipakai", enabled: true, componentIds: [] },
      { id: "on", name: d.name, enabled: true, componentIds: [d.id] },
    ],
  }));
  return projectV2Schema.parse(deriveEditedAreas({ ...declareDemonstrationScience(p, uncertainty), drawingScale: { metersPerUnit: 1, initialLength: 20, initialWidth: 10, source: "Dimensi sintetis contoh 20 × 10 m, bukan survei." } }));
}

/** Product-facing synthetic demo: current intervention set only. Legacy fixture above stays stable for compatibility tests. */
export function currentDemoProject(complete = true, uncertainty = false): ProjectV2 {
  let p = demoProject(complete, uncertainty);
  const retired = new Set(p.components.filter(c => c.family === "permeable").map(c => c.id));
  p.components = p.components.filter(c => !retired.has(c.id));
  p.optionGroups = p.optionGroups.filter(g => !g.choices.some(choice => choice.componentIds.some(id => retired.has(id))));
  // This wrapper owns only synthetic demo evidence; rebuild it after the current component set is complete.
  p.science = undefined;
  for (const scenarioId of ["r50", "r100"]) {
    p = saveComponent(p, {
      id: "biopori", name: "Biopori halaman", family: "infiltration", targets: ["z1"], siteId: "site-main",
      connection: "Target dipilih pengguna pada zona yang dinyatakan.",
      applicability: "Kapasitas demo per kejadian; perlu verifikasi teknis sebelum desain.",
      cost: known(2_000_000), area: known(2), scenarioId, capacity: known(2), reuse: null,
      infiltrationType: "biopori",
      treatment: { installationZoneId: "z2", sharedSourceMode: "ledger", allocationNote: "Demo sintetis: urutan neraca dinyatakan eksplisit.", catchmentReviewed: true },
    });
  }
  p.optionGroups.push({ id: "choice-biopori", name: "Biopori", enabled: true, choices: [
    { id: "off", name: "Tidak dipakai", enabled: true, componentIds: [] },
    { id: "on", name: "Biopori", enabled: true, componentIds: ["biopori"] },
  ]});
  return projectV2Schema.parse(declareDemonstrationScience(p, uncertainty));
}

export const options = [
  { id: "tank", name: "Tangki", family: "Tangki", domainFamily: "storage", disposition: "retained", mark: "T", biopori: false },
  { id: "soak", name: "Sumur / area resapan", family: "Sumur / area resapan", domainFamily: "infiltration", disposition: "infiltrated", mark: "S", biopori: false },
  { id: "garden", name: "Rain garden", family: "Rain garden", domainFamily: "rain-garden", disposition: "infiltrated", mark: "R", biopori: false },
  { id: "biopori", name: "Biopori", family: "Biopori", domainFamily: "infiltration", disposition: "infiltrated", mark: "B", biopori: true },
] as const;
export type OptionId = string;
export type InterventionKind = (typeof options)[number]['id'];
export function setActiveComponents(
  project: ProjectV2,
  active: readonly OptionId[],
): ProjectV2 {
  const selected = new Set<OptionId>(active);
  let next = structuredClone(project);
  for (const id of active) {
    if (next.components.some(c => c.id === id)) continue;
    const option = options.find(o => o.id === id);
    if (!option) throw new Error('Intervensi belum tersedia. Tambahkan jenis penanganan terlebih dahulu.');
    const scenarioId = next.scenarios[0]?.id;
    if (!scenarioId) throw new Error('Tambahkan skenario hujan sebelum membuat penanganan.');
    next = saveComponent(next, {
      id, name: option.name, family: option.domainFamily, targets: [], siteId: "",
      connection: "", applicability: "", cost: unknownInput(), area: unknownInput(),
      scenarioId, capacity: unknownInput(), reuse: null,
      infiltrationType: option.biopori ? "biopori" : undefined,
    });
    next.optionGroups.push({ id: `choice-${id}`, name: option.name, enabled: true,
      choices: [{ id: "off", name: "Tidak dipakai", enabled: true, componentIds: [] }, { id: "on", name: option.name, enabled: true, componentIds: [id] }],
    });
  }
  next.components = next.components.map((component) => ({
    ...component,
    enabled: selected.has(component.id as OptionId),
  }));
  next.optionGroups = next.optionGroups.map((group) => {
    const id = group.id.startsWith("choice-")
      ? (group.id.slice("choice-".length) as OptionId)
      : null;
    return id && next.components.some(component => component.id === id)
      ? { ...group, enabled: selected.has(id) }
      : group;
  });
  return clearInactiveDestinations(next);
}
function capacityRef(
  project: ProjectV2,
  id: OptionId,
  scenarioId: string,
) {
  const component = project.components.find((c) => c.id === id);
  const perf = component?.performanceByScenario[scenarioId];
  if (!perf) return undefined;
  return "availableStorage" in perf
    ? perf.availableStorage
    : "infiltrationCapacity" in perf
      ? perf.infiltrationCapacity
      : perf.additionalInfiltrationCapacity;
}
export function componentEditorValues(
  project: ProjectV2,
  id: OptionId,
  scenarioId: string,
) {
  const component = project.components.find((c) => c.id === id);
  if (!component) return null;
  const capacity = capacityRef(project, id, scenarioId);
  return {
    component,
    cost: readInput(project, component.totalCost),
    area: readInput(project, component.occupiedArea),
    capacity: readInput(project, capacity, scenarioId),
  };
}
export interface Limits {
  budget: number | null;
  land: number | null;
}
export function limitsFromProject(project: ProjectV2): Limits {
  return {
    budget: valueOf(project, project.constraints.budget),
    land: valueOf(project, project.constraints.usableArea),
  };
}
export function evaluationFromBalance(
  project: ProjectV2,
  scenarioId: string,
  balance: PlanBalance,
) {
  const baseline = productionBaseline(project, scenarioId);
  if (!baseline.ok) return null;
  return {
    baseline: baseline.value,
    retained: balance.stored,
    infiltrated: balance.infiltrated,
    reused: balance.reused,
    residual: balance.residual,
    cost: balance.cost,
    area: balance.area,
    feasible: true,
    reasons: [] as string[],
  };
}
export type Evaluation = NonNullable<ReturnType<typeof evaluationFromBalance>>;
export function evaluate(
  project: ProjectV2,
  scenarioId: string,
  ids: readonly OptionId[],
): Evaluation | null {
  try {
    if (ids.length === 0) {
      const baseline = productionBaseline(project, scenarioId);
      if (!baseline.ok) return null;
      return {
        baseline: baseline.value,
        retained: 0,
        infiltrated: 0,
        reused: 0,
        residual: baseline.value.runoffM3,
        cost: 0,
        area: 0,
        feasible: true,
        reasons: [],
      };
    }
    const p = project;
    const plan = snapshotPlan(
      p,
      [...ids],
      `preview-${ids.join("-")}`,
      "Pratinjau",
    );
    const result = evaluatePlan(p, plan, scenarioId);
    if (!result.ok) return null;
    return evaluationFromBalance(p, scenarioId, result.value);
  } catch {
    return null;
  }
}
export function alternativeSearch(
  project: ProjectV2,
  scenarioId: string,
) {
  project=pilotSearchProject(project);
  const groups = project.optionGroups.filter(g => g.enabled);
  const declared = (groups.length ? groups.reduce((n, g) => n * g.choices.filter(c => c.enabled).length, 1) : 0) + project.manualPlans.length;
  try {
    const p = project;
    const result = optimize(p, scenarioId);
    if (!result.ok)
      return {
        rows: [],
        declared,
        evaluated: 0,
        rejected: 0,
        dominated: 0,
        excluded: [],
        superseded: [],
        issues: result.issues.map((issue) => issue.message),
      };
    return {
      rows: result.value.alternatives.map((a, index) => {
        const ids = a.plan.components
          .filter((c) => c.enabled)
          .map((c) => c.id as OptionId);
        return {
          plan: a.plan,
          balance: a.balance,
          id: a.plan.id || `pareto-${index + 1}`,
          name: a.plan.name || `Alternatif ${index + 1}`,
          optionIds: ids,
          description:
            a.plan.components.filter(c => c.enabled)
              .map(c => c.name)
              .join(" + ") || "Tanpa intervensi",
          result: evaluationFromBalance(p, scenarioId, a.balance),
          nonDominated: true,
        };
      }),
      declared: result.value.declared,
      evaluated: result.value.evaluated,
      rejected: result.value.rejected,
      dominated: result.value.dominated,
      excluded: result.value.excluded,
      superseded: result.value.superseded,
      issues: result.value.reasons.map(
        (reason) => `${reason.message} (${reason.count})`,
      ),
    };
  } catch (cause) {
    return {
      rows: [],
      declared,
      evaluated: 0,
      rejected: 0,
      dominated: 0,
      excluded: [],
      superseded: [],
      issues: [
        cause instanceof Error
          ? cause.message
          : "Alternatif belum dapat dihitung.",
      ],
    };
  }
}
export const snapshotSchema = z.strictObject({
  version: z.literal(2),
  project: projectV2Schema,
  scenario: z.string(),
  draft: z.array(z.string().min(1).max(120)).max(1000),
  chosen: z.string().nullable(),
  limits: z.strictObject({
    budget: z.number().finite().nonnegative().nullable(),
    land: z.number().finite().nonnegative().nullable(),
  }),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export function initialSnapshot(): Snapshot { return blankSnapshot(); }
export function blankSnapshot(): Snapshot {
  const project = createProjectV2(
    `friday-${crypto.randomUUID()}`,
    "Belum ada proyek",
    new Date().toISOString(),
  );
  return {
    version: 2,
    project,
    scenario: project.scenarios[0]!.id,
    draft: [],
    chosen: null,
    limits: { budget: null, land: null },
  };
}
