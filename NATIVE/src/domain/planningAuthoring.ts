import { unreviewedReceivingSite } from './siteEvidence';
import { projectV2Schema, type ProjectV2 } from "./projectV2";
import type { ParameterV2, ReferenceV2 } from "./v2-primitives";
import type { ComponentVariant } from "./intervention-contract";
import { numericInput } from "./validation";

export type SourcedInput = {
  text: string;
  source: string;
  evidence: ParameterV2["evidence"];
};
export const emptyInput = (): SourcedInput => ({
  text: "",
  source: "",
  evidence: "USER_INPUT",
});
function canonicalJson(value: unknown): string {
  const canonical = (child: unknown): unknown => Array.isArray(child)
    ? child.map(canonical)
    : child !== null && typeof child === "object"
      ? Object.fromEntries(Object.entries(child).sort(([a],[b]) => a.localeCompare(b, "en")).map(([key, nested]) => [key, canonical(nested)]))
      : child;
  return JSON.stringify(canonical(value));
}

export function readInput(
  p: ProjectV2,
  ref: ReferenceV2 | undefined,
  scenarioId?: string,
): SourcedInput {
  const effective = p.scenarios.find(s => s.id === scenarioId)?.overrides.find(o => o.baseParameterId === ref?.id)?.replacement ?? ref;
  const v = p.parameters.find((v) => v.id === effective?.id);
  return {
    text: v?.value == null ? "" : String(v.value),
    source: v?.source ?? "",
    evidence:
      v?.evidence === "UNKNOWN" ? "USER_INPUT" : (v?.evidence ?? "USER_INPUT"),
  };
}
export function writeParameter(
  p: ProjectV2,
  id: string,
  unit: ParameterV2["unit"],
  input: SourcedInput,
): ReferenceV2 {
  const parsed = numericInput(input.text);
  if (!parsed.ok) throw new Error(parsed.issues[0]!.message);
  if (parsed.value !== null && !input.source.trim())
    throw new Error(
      "Catat sumber atau nyatakan perkiraan untuk setiap angka yang diisi.",
    );
  const index = p.parameters.findIndex((v) => v.id === id),
    previous = p.parameters[index];
  const parameter: ParameterV2 = {
    id,
    unit,
    value: parsed.value,
    revision: previous && previous.unit === unit && previous.value === parsed.value
      && previous.evidence === (parsed.value === null ? "UNKNOWN" : input.evidence)
      && previous.source === input.source.trim()
      ? previous.revision : (previous?.revision ?? 0) + 1,
    evidence: parsed.value === null ? "UNKNOWN" : input.evidence,
    source: input.source.trim(),
    note: previous?.note ?? "",
    applicability: previous?.applicability ?? "",
  };
  if (index < 0) p.parameters.push(parameter);
  else p.parameters[index] = parameter;
  const ref = { id, unit, evidence: parameter.evidence };
  // Update all live references to a shared value; frozen plan snapshots retain their own evidence.
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (
      obj.id === id &&
      "unit" in obj &&
      "evidence" in obj &&
      !("value" in obj)
    ) {
      obj.evidence = parameter.evidence;
      return;
    }
    for (const [key, child] of Object.entries(obj))
      if (!["manualPlans", "selectedPlan", "parameters"].includes(key))
        walk(child);
  };
  walk(p);
  return ref;
}
export function saveRain(
  p: ProjectV2,
  id: string,
  name: string,
  rain: SourcedInput,
  note: string,
): ProjectV2 {
  const next = structuredClone(p),
    old = next.scenarios.find((s) => s.id === id);
  const previousScenario = old ? structuredClone(old) : null;
  const override = old?.overrides.find(o => o.baseParameterId === old.rainfall.id)?.replacement;
  const previousEffectiveId = override?.id ?? old?.rainfall.id;
  const previousEffectiveRevision = previousEffectiveId ? p.parameters.find(v => v.id === previousEffectiveId)?.revision : undefined;
  const previousDepth = old && readInput(p, old.rainfall, id).text;
  const oldName = old?.name.match(/^Hujan( uji)? ([\d.,]+) mm$/);
  const emptyName = old?.name.match(/^Hujan( uji)? belum diisi$/);
  const automaticName = !!old && name === old.name && (
    !!oldName && previousDepth !== '' && Number(oldName[2]?.replace(',','.')) === Number(previousDepth)
    || !!emptyName && previousDepth === ''
  );
  const rainfall = writeParameter(
    next,
    override?.id ?? old?.rainfall.id ?? `${id}-depth`,
    "mm",
    rain,
  );
  if (old) {
    old.name = automaticName
      ? `Hujan${oldName?.[1] ?? emptyName?.[1] ?? ''} ${rain.text.trim() ? `${new Intl.NumberFormat('id-ID',{maximumFractionDigits:12}).format(Number(rain.text.replace(',','.')))} mm` : 'belum diisi'}`
      : name;
    if (!override) old.rainfall = rainfall;
    old.eventWindowNote = note;
    const effectiveRevision = next.parameters.find(v => v.id === rainfall.id)?.revision;
    const parameterChanged = previousEffectiveRevision !== effectiveRevision;
    const scenarioChanged = previousScenario ? canonicalJson({...previousScenario,revision:0}) !== canonicalJson({...old,revision:0}) : true;
    old.revision = previousScenario && !parameterChanged && !scenarioChanged ? previousScenario.revision : (previousScenario?.revision ?? 0) + 1;
  } else
    next.scenarios.push({
      id,
      name,
      revision: 1,
      rainfall,
      eventWindowNote: note,
      overrides: [],
    });
  return projectV2Schema.parse(next);
}
export function deleteRainScenario(p: ProjectV2, id: string): ProjectV2 {
  const next = structuredClone(p);
  if (!next.scenarios.some(s => s.id === id)) return next;
  next.scenarios = next.scenarios.filter(s => s.id !== id);
  next.constraints.requiredScenarioIds = next.constraints.requiredScenarioIds.filter(scenarioId => scenarioId !== id);
  for (const component of next.components) delete component.performanceByScenario[id];
  if (next.science) {
    delete next.science.rainfall[id];
    for (const evidence of Object.values(next.science.interventions)) delete evidence.performance[id];
  }
  return projectV2Schema.parse(next);
}

export type ComponentInput = {
  id: string;
  name: string;
  family: ComponentVariant["family"];
  targets: string[];
  siteId: string;
  connection: string;
  applicability: string;
  cost: SourcedInput;
  area: SourcedInput;
  scenarioId: string;
  capacity: SourcedInput;
  reuse: SourcedInput | null;
  planningNotes?: string;
  siteAssessment?: ComponentVariant["siteAssessment"];
  treatment?: ComponentVariant["treatment"];
  waterUse?: Extract<ComponentVariant, { family: "storage" }>["waterUse"];
  drawdown?: Extract<ComponentVariant, { family: "storage" }>["drawdown"];
  infiltrationType?: Extract<ComponentVariant, { family: "infiltration" }>["infiltrationType"];
  plantingPlan?: Extract<ComponentVariant, { family: "rain-garden" }>["plantingPlan"];
};
export function saveComponent(p: ProjectV2, data: ComponentInput): ProjectV2 {
  if (data.family === "permeable" && data.targets.length > 1)
    throw new Error("Pilih satu zona yang ingin diganti menjadi permukaan berpori.");
  for (const [input, label] of [[data.cost, "Biaya"], [data.area, "Luas pemasangan"], [data.capacity, "Kapasitas air"]] as const) {
    const parsed = numericInput(input.text);
    if (!parsed.ok) throw new Error(`${label}: masukkan angka nol atau positif. Kosongkan jika belum diketahui.`);
    if (parsed.value !== null && !input.source.trim()) throw new Error(`${label}: pilih dasar angka, misalnya Asumsi pribadi atau hasil pengukuran.`);
  }
  const next = structuredClone(p),
    old = next.components.find((c) => c.id === data.id);
  if (old && old.family !== data.family)
    throw new Error("Buat intervensi terpisah untuk keluarga yang berbeda.");
  if (!next.scenarios.some((s) => s.id === data.scenarioId))
    throw new Error("Buat skenario hujan terlebih dahulu.");
  const cost = writeParameter(
    next,
    old?.totalCost.id ?? `${data.id}-cost`,
    "IDR",
    data.cost,
  );
  const area = writeParameter(
    next,
    old?.occupiedArea.id ?? `${data.id}-area`,
    "m2",
    data.area,
  );
  const oldPerf = old?.performanceByScenario[data.scenarioId];
  const oldCapacity =
    oldPerf &&
    ("availableStorage" in oldPerf
      ? oldPerf.availableStorage
      : "infiltrationCapacity" in oldPerf
        ? oldPerf.infiltrationCapacity
        : oldPerf.additionalInfiltrationCapacity);
  const override = next.scenarios.find(s => s.id === data.scenarioId)?.overrides.find(o => o.baseParameterId === oldCapacity?.id)?.replacement;
  const writtenCapacity = writeParameter(
    next,
    override?.id ?? oldCapacity?.id ?? `${data.id}-${data.scenarioId}-capacity`,
    "m3/event",
    data.capacity,
  );
  const capacity = override ? oldCapacity! : writtenCapacity;
  const reviewedRain = readInput(next, next.scenarios.find(s => s.id === data.scenarioId)?.rainfall, data.scenarioId).text;
  const reviewedRainfallMm = reviewedRain === "" ? null : Number(reviewedRain);
  const common = {
    id: data.id,
    name: data.name,
    revision: (old?.revision ?? 0) + 1,
    enabled: old?.enabled ?? true,
    targets: data.targets,
    connectionNote: data.connection,
    installationSiteId: data.siteId || null,
    occupiedArea: area,
    totalCost: cost,
    applicability: data.applicability,
    planningNotes: data.planningNotes ?? old?.planningNotes,
    siteAssessment: data.siteAssessment ?? old?.siteAssessment,
    treatment: data.treatment ?? old?.treatment,
    excludes: old?.excludes ?? [],
    placement: old?.placement ?? null,
  };
  let c: ComponentVariant;
  if (data.family === "storage") {
    const oldDemand = oldPerf && 'reuse' in oldPerf && oldPerf.reuse.mode === 'capture-then-reuse' ? oldPerf.reuse.demand : undefined;
    const demandOverride = next.scenarios.find(s => s.id === data.scenarioId)?.overrides.find(o => o.baseParameterId === oldDemand?.id)?.replacement;
    const writtenDemand = data.reuse
      ? writeParameter(
          next,
          demandOverride?.id ?? oldDemand?.id ?? `${data.id}-${data.scenarioId}-reuse`,
          "m3/event",
          data.reuse,
        )
      : null;
    const demand = writtenDemand && demandOverride ? oldDemand! : writtenDemand;
    c = {
      ...common,
      family: "storage",
      waterUse: data.waterUse ?? (old?.family === "storage" ? old.waterUse : undefined),
      drawdown: data.drawdown ?? (old?.family === "storage" ? old.drawdown : undefined),
      performanceByScenario: {
        ...(old?.family === "storage" ? old.performanceByScenario : {}),
        [data.scenarioId]: {
          applicability: data.applicability,
          reviewedRainfallMm,
          availableStorage: capacity,
          reuse: demand
            ? { mode: "capture-then-reuse", demand }
            : { mode: "off" },
        },
      },
    };
  } else if (data.family === "permeable")
    c = {
      ...common,
      family: "permeable",
      treatedArea: area,
      performanceByScenario: {
        ...(old?.family === "permeable" ? old.performanceByScenario : {}),
        [data.scenarioId]: {
          applicability: data.applicability,
          reviewedRainfallMm,
          additionalInfiltrationCapacity: capacity,
        },
      },
    };
  else
    c = {
      ...common,
      family: data.family,
      performanceByScenario: {
        ...((old?.family === "infiltration" && (old.infiltrationType ?? "well") === (data.infiltrationType ?? old.infiltrationType ?? "well")) || old?.family === "rain-garden"
          ? old.performanceByScenario
          : {}),
        [data.scenarioId]: {
          applicability: data.applicability,
          infiltrationCapacity: capacity,
          reviewedRainfallMm,
        },
      },
    };
  const index = next.components.findIndex((c) => c.id === data.id);
  if (c.family === "infiltration") c.infiltrationType = data.infiltrationType ?? (old?.family === "infiltration" ? old.infiltrationType : undefined);
  if (c.family === "rain-garden") c.plantingPlan = data.plantingPlan ?? (old?.family === "rain-garden" ? old.plantingPlan : undefined);
  if (old) {
    const same = canonicalJson({...old,revision:0}) === canonicalJson({...c,revision:0});
    c.revision = same ? old.revision : old.revision + 1;
  }
  if (index < 0) next.components.push(c);
  else next.components[index] = c;
  if (old && c.family !== 'storage' && (old.treatment?.installationZoneId ?? null) !== (c.treatment?.installationZoneId ?? null)) {
    const evidence = next.science?.interventions[c.id];
    if (evidence) next.science!.interventions[c.id] = unreviewedReceivingSite(evidence);
    c.siteAssessment = { connection: 'unknown', infiltration: 'unknown', plantingSpace: 'unknown', surfaceChange: 'unknown', source: '' };
  }
  return projectV2Schema.parse(next);
}
