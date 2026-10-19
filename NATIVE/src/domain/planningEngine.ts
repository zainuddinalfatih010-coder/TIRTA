import { projectV2Schema, type ProjectV2 } from "./projectV2";
import type { planSchema } from "./intervention-contract";
import type { z } from "zod";
import type { ParameterV2, ReferenceV2 } from "./v2-primitives";
import type { Outcome, Issue } from "./model";
import { productionBaseline } from "./productionBaseline";
import { baselineIdentity } from "./scenario";
import { polygonsOverlap } from "./geometry";
import { assessIntervention } from './feasibility';
import { referencedParameters } from './parameterReferences';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export type Plan = z.infer<typeof planSchema>;
/** Ledger convention, not a hydraulic flow simulation. Keeps source/target order explicit. */
export function allocationSequence(plan: Plan) {
  const ordered = plan.priority.flatMap(id => plan.components.filter(c => c.enabled && c.id === id));
  return [...ordered.filter(c => c.family === 'permeable'), ...ordered.filter(c => c.family !== 'permeable')];
}
export const familyLabels = {
  storage: "Tangki",
  infiltration: "Sumur / area resapan",
  "rain-garden": "Taman hujan",
  permeable: "Permukaan berpori",
} as const;
export type Treatment = {
  id: string;
  stored: number;
  reused: number;
  infiltrated: number;
  handled: number;
  byZone: Record<string, number>;
};
export type PlanBalance = {
  scenarioId: string;
  baseline: number;
  residual: number;
  stored: number;
  reused: number;
  infiltrated: number;
  cost: number;
  area: number;
  budget: number;
  usableArea: number;
  components: Treatment[];
  remainingByZone: Record<string, number>;
};
class InputError extends Error {
  constructor(message: string, readonly target: Partial<Issue> = {}) { super(message); }
}
export function planningParameterValue(
  parameters: ParameterV2[],
  ref: ReferenceV2,
  unit: ReferenceV2["unit"],
  label: string,
): number {
  const p = parameters.find((x) => x.id === ref.id);
  if (!p || ref.unit !== unit || p.unit !== unit || ref.evidence !== p.evidence)
    throw new InputError(`${label}: satuan atau sumber tidak cocok.`, { parameterId: ref.id });
  if (p.value === null || p.evidence === "UNKNOWN")
    throw new InputError(`${label}: belum diketahui.`, { parameterId: ref.id });
  if (!p.source.trim() || p.evidence === "ASSIST_SUGGESTION")
    throw new InputError(`${label}: lengkapi sumber yang sesuai.`, { parameterId: ref.id });
  if (!Number.isFinite(p.value) || p.value < 0)
    throw new InputError(`${label}: angka tidak valid.`, { parameterId: ref.id });
  return p.value;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, canonical(child)]));
  return value;
}
function byId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
/** Previous identity, retained for current-decision migration and printed report metadata. */
export function legacyPlanningFingerprint(p: ProjectV2): string {
  const scenarios = byId(p.scenarios).map(s => ({ ...s, overrides: [...s.overrides].sort((a, b) => a.baseParameterId < b.baseParameterId ? -1 : a.baseParameterId > b.baseParameterId ? 1 : 0) }));
  return `event-ledger-v1:${stableId(JSON.stringify(canonical({
    engine: "event-ledger-v1",
    scenarios,
    baselines: scenarios.map((s) => baselineIdentity(p, s.id)),
    constraints: { ...p.constraints, requiredScenarioIds: [...p.constraints.requiredScenarioIds].sort() },
    parameters: byId(p.parameters),
    sites: byId(p.installationSites),
    science: p.science ? { ...p.science, connections: byId(p.science.connections), legacyNeedsVerification: [...p.science.legacyNeedsVerification].sort(), observations: [] } : null,
    // Component and target order are declared allocation priorities, never sorted.
    components: p.components,
    options: byId(p.optionGroups).map(g => ({ ...g, choices: byId(g.choices).map(c => ({ ...c, componentIds: [...c.componentIds].sort() })) })),
    ...(p.manualPlans.length ? { variants: byId(p.manualPlans).map(plan => ({ id: plan.id, components: plan.components, parameters: byId(plan.parameters), priority: plan.priority, scientificEvidence: plan.scientificEvidence })) } : {}),
  })))}`;
}
/** Decision inputs only. Field/report documentation has a separate identity below. */
export function planningFingerprint(p: ProjectV2): string {
  const parameters=(items:ParameterV2[])=>byId(items).map(v=>({id:v.id,value:v.value,unit:v.unit,evidence:v.evidence,sourcePresent:!!v.source.trim()}));
  const component=(c:ProjectV2['components'][number])=>({id:c.id,family:c.family,enabled:c.enabled,targets:c.targets,installationSiteId:c.installationSiteId,occupiedArea:c.occupiedArea,totalCost:c.totalCost,excludes:[...c.excludes].sort(),
    installationZoneId:c.treatment?.installationZoneId??null,sharedSourceMode:c.treatment?.sharedSourceMode??'unresolved',
    infiltrationType:c.family==='infiltration'?c.infiltrationType:null,treatedArea:c.family==='permeable'?c.treatedArea:null,
    performance:Object.fromEntries(Object.entries(c.performanceByScenario).map(([sid,perf])=>[sid,Object.fromEntries(Object.entries(perf).filter(([key])=>!['applicability','reviewedRainfallMm'].includes(key)))]))});
  const scenarios=byId(p.scenarios).map(s=>({id:s.id,rainfall:s.rainfall,overrides:[...s.overrides].sort((a,b)=>a.baseParameterId.localeCompare(b.baseParameterId))}));
  const sites=byId(p.installationSites).map(s=>({id:s.id,availableArea:s.availableArea,polygon:s.polygon}));
  const components=p.components.map(component);
  const inputs={components,scenarios,sites,constraints:{...p.constraints,requiredScenarioIds:[...p.constraints.requiredScenarioIds].sort()}};
  const gates=(cs:ProjectV2['components'],params:ParameterV2[],frozen?:Plan['scientificEvidence'])=>scenarios.map(s=>({id:s.id,components:cs.filter(c=>c.enabled).map(c=>({id:c.id,issues:(()=>{const f=assessIntervention(p,c,s.id,params,frozen?.[c.id],true,cs.filter(c=>c.enabled));return [...f.reasons,...f.missing].map(x=>({rule:x.ruleId,field:x.field??null}));})()}))}));
  const baselines=scenarios.map(s=>{const b=productionBaseline(p,s.id);return b.ok?{id:s.id,area:b.value.areaM2,rain:b.value.rainfallMm,zones:b.value.zones.map(z=>({id:z.id,area:z.areaM2,coefficient:z.coefficient,runoff:z.runoffM3}))}:{id:s.id,issues:b.issues.map(i=>({code:i.code,path:i.path}))};});
  return `model-decision-v2:${stableId(JSON.stringify(canonical({...inputs,baselines,parameters:parameters(referencedParameters(p.parameters,inputs)),gates:gates(p.components,p.parameters),
    options:byId(p.optionGroups).map(g=>({id:g.id,enabled:g.enabled,choices:byId(g.choices).map(c=>({id:c.id,enabled:c.enabled,componentIds:[...c.componentIds].sort()}))})),
    variants:byId(p.manualPlans).map(plan=>({id:plan.id,components:plan.components.map(component),parameters:parameters(plan.parameters),priority:plan.priority,gates:gates(plan.components,plan.parameters,plan.scientificEvidence)})),
  })))}`;
}
export function verificationFingerprint(p:ProjectV2):string {
  return `verification-v1:${stableId(JSON.stringify(canonical({science:p.science,components:p.components.map(c=>({id:c.id,name:c.name,placement:c.placement,notes:c.planningNotes,siteAssessment:c.siteAssessment})),goal:p.planningGoal})))}`;
}
export function snapshotPlan(
  p: ProjectV2,
  ids: string[],
  id: string,
  name: string,
  origin: Plan["origin"] = "manual",
): Plan {
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !p.components.some((c) => c.id === id && c.enabled))
  )
    throw new InputError("Pilihan intervensi tidak tersedia.", {field:"selection"});
  const components = ids.map(id => structuredClone(p.components.find(c => c.id === id)!));
  return {
    id,
    name,
    revision: 1,
    origin,
    components,
    parameters: structuredClone(referencedParameters(p.parameters, components)),
    scientificEvidence: Object.fromEntries(components.filter(c => p.science?.interventions[c.id]).map(c => [c.id, structuredClone(p.science!.interventions[c.id]!)])),
    priority: [...ids],
    optimizationScenarioId: p.scenarios[0]?.id ?? null,
    comparisonScenarioIds: p.scenarios.map((s) => s.id),
    originInputFingerprint: null,
    reviewedInputFingerprint: null,
    note: "",
  };
}
export function decisionReady(p: ProjectV2, plan: Plan): boolean {
  if (!plan.optimizationScenarioId) return false;
  return [
    ...new Set([
      plan.optimizationScenarioId,
      ...p.constraints.requiredScenarioIds,
    ]),
  ].every((s) => evaluatePlan(p, plan, s).ok);
}
export function evaluatePlan(
  p: ProjectV2,
  plan: Plan,
  scenarioId: string,
): Outcome<PlanBalance> {
  return evaluateLedger(p, plan, scenarioId, true);
}
/** The same conservation ledger, without financial/site allocation gates. Never substitutes unknown cost with a displayed zero. */
export function evaluateEventPlan(p: ProjectV2, plan: Plan, scenarioId: string): Outcome<Omit<PlanBalance, 'cost' | 'area' | 'budget' | 'usableArea'>> {
  const result = evaluateLedger(p, plan, scenarioId, false);
  if (!result.ok) return result;
  const { scenarioId: sid, baseline, stored, reused, infiltrated, residual, components, remainingByZone } = result.value;
  const water = { scenarioId: sid, baseline, stored, reused, infiltrated, residual, components, remainingByZone };
  return { ok: true, value: water };
}
function evaluateLedger(p: ProjectV2, plan: Plan, scenarioId: string, includeResources: boolean): Outcome<PlanBalance> {
  const invalid = (message: string, target: Partial<Issue> = {}): Outcome<never> => ({
    ok: false,
    issues: [{ code: "plan_input", path: "interventions", message, ...target }],
  });
  const parsed = projectV2Schema.safeParse({
    ...p,
    selectedPlan: {
      definition: plan,
      decisionNote: "",
      reviewedInputFingerprint: null,
    },
  });
  if (!parsed.success)
    return invalid("Definisi rencana atau referensi data tidak valid.");
  const baseline = productionBaseline(p, scenarioId);
  if (!baseline.ok) return baseline;
  try {
    const b = baseline.value;
    const budget = includeResources ? planningParameterValue(
      p.parameters,
      p.constraints.budget,
      "IDR",
      "Batas anggaran",
    ) : 0;
    const usableArea = includeResources ? planningParameterValue(
      p.parameters,
      p.constraints.usableArea,
      "m2",
      "Lahan tersedia",
    ) : 0;
    if (includeResources && usableArea > b.areaM2)
      throw new InputError("Lahan tersedia melebihi luas persil.", {field:"land"});
    const cs = plan.components.filter((c) => c.enabled);
    const scientificBlockers = cs.flatMap(c => {
      const f = assessIntervention(p, c, scenarioId, plan.parameters, plan.scientificEvidence?.[c.id], includeResources, cs);
      return [...f.reasons, ...f.missing].map(x => ({message: `${c.name}: ${x.message}`, componentId:c.id, field:x.field ?? x.ruleId.toLowerCase(), ruleId:x.ruleId}));
    });
    if (scientificBlockers.length) throw new InputError(scientificBlockers.map(x=>x.message).join(" "), scientificBlockers[0]);
    if (new Set(cs.map((c) => c.id)).size !== cs.length)
      throw new InputError("Intervensi ganda dalam rencana.", {field:"selection"});
    if (
      plan.priority.length !== cs.length ||
      new Set(plan.priority).size !== cs.length ||
      plan.priority.some((id) => !cs.some((c) => c.id === id))
    )
      throw new InputError(
        "Urutan penanganan harus memuat setiap intervensi tepat sekali.", {field:"priority"},
      );
    if (includeResources && cs.length < p.constraints.minInstallations)
      throw new InputError("Jumlah intervensi belum memenuhi batas minimum.", {field:"minInstallations"});
    const scenario = p.scenarios.find((s) => s.id === scenarioId)!;
    const get = (
      ref: ReferenceV2,
      unit: ReferenceV2["unit"],
      label: string,
      overrides = false,
    ) => {
      const override = overrides
        ? scenario.overrides.find((o) => o.baseParameterId === ref.id)
            ?.replacement
        : undefined;
      return planningParameterValue(
        override ? p.parameters : plan.parameters,
        override ?? ref,
        unit,
        label,
      );
    };
    let cost = 0,
      area = 0;
    const allocated = new Map<string, number>();
    const sites = p.installationSites.filter((s) => includeResources &&
      cs.some((c) => c.installationSiteId === s.id),
    );
    for (let i = 0; i < sites.length; i++)
      for (let j = 0; j < i; j++) {
        const a = sites[i]!,
          b = sites[j]!;
        if (a.polygon && b.polygon && polygonsOverlap(a.polygon, b.polygon))
          throw new InputError(
            "Alokasi lokasi pemasangan tumpang tindih. Pisahkan ruang yang dipakai masing-masing lokasi.", {field:"installation"},
          );
      }
    for (const c of cs) {
      if (
        !c.targets.length ||
        new Set(c.targets).size !== c.targets.length ||
        c.targets.some((id) => !p.zones.some((z) => z.id === id))
      )
        throw new InputError(
          `${c.name}: pilih zona target yang masih tersedia.`, {componentId:c.id,field:"source"},
        );
      if (c.excludes.some((id) => cs.some((x) => x.id === id)))
        throw new InputError(
          `${c.name}: bertentangan dengan intervensi lain dalam rencana.`, {componentId:c.id,field:"sharedSourceMode"},
        );
      if (!includeResources) continue;
      const site = p.installationSites.find(
        (s) => s.id === c.installationSiteId,
      );
      if (c.installationSiteId && !site)
        throw new InputError(
          `${c.name}: tentukan lokasi pemasangan dan asumsi kesesuaiannya.`, {componentId:c.id,field:"installation"},
        );
      const occupied = get(c.occupiedArea, "m2", `${c.name} · lahan`);
      const available = site ? planningParameterValue(
        p.parameters,
        site.availableArea,
        "m2",
        `${site.name} · luas tersedia`,
      ) : usableArea;
      const siteId = site?.id ?? '__project-allowance';
      const used = (allocated.get(siteId) ?? 0) + occupied;
      if (used > available)
        throw new InputError(
          `${site?.name ?? 'Lahan proyek'}: kebutuhan lahan melebihi ruang tersedia.`, {componentId:c.id,field:"area"},
        );
      allocated.set(siteId, used);
      area += occupied;
      cost += get(c.totalCost, "IDR", `${c.name} · biaya`);
    }
    if (includeResources && cost > budget)
      throw new InputError("Biaya rencana melebihi batas anggaran.", {field:"budget"});
    if (includeResources && area > usableArea)
      throw new InputError("Kebutuhan lahan rencana melebihi lahan tersedia.", {field:"land"});
    const remaining = Object.fromEntries(
      b.zones.map((z) => [z.id, z.runoffM3]),
    );
    const treatments: Treatment[] = [];
    const porousTargets = new Set<string>();
    // Local additional infiltration is debited before downstream capture. Map proximity never defines routing.
    const sequence = allocationSequence(plan);
    for (const c of sequence) {
      const t: Treatment = {
        id: c.id,
        stored: 0,
        reused: 0,
        infiltrated: 0,
        handled: 0,
        byZone: {},
      };
      const debit = (capacity: number) => {
        let left = capacity;
        for (const id of c.targets) {
          const used = Math.min(left, remaining[id]!);
          t.byZone[id] = used;
          remaining[id]! -= used;
          left -= used;
        }
        return Object.values(t.byZone).reduce((a, v) => a + v, 0);
      };
      if (c.family === "permeable") {
        const perf = c.performanceByScenario[scenarioId];
        if (!perf)
          throw new InputError(
            `${c.name}: kapasitas untuk skenario ini belum dinyatakan.`, {componentId:c.id,field:"capacity"},
          );
        const z = p.zones.find((z) => z.id === c.targets[0])!;
        if (
          c.targets.length !== 1 ||
          z.surface === "porous" ||
          porousTargets.has(z.id)
        )
          throw new InputError(
            `${c.name}: gunakan satu zona yang belum berpori; satu perlakuan per zona.`, {componentId:c.id,field:"source"},
          );
        porousTargets.add(z.id);
        const zb = b.zones.find((x) => x.id === z.id)!;
        const treated = get(c.treatedArea, "m2", `${c.name} · luas perlakuan`);
        if (treated !== get(c.occupiedArea, "m2", `${c.name} · lahan`))
          throw new InputError(
            `${c.name}: lahan yang digunakan harus sama dengan luas perlakuan.`, {componentId:c.id,field:"area"},
          );
        if (treated <= 0 || treated > zb.areaM2)
          throw new InputError(
            `${c.name}: luas perlakuan harus positif dan tidak melebihi zona.`, {componentId:c.id,field:"area"},
          );
        const k = get(
          perf.additionalInfiltrationCapacity,
          "m3/event",
          `${c.name} · infiltrasi tambahan`,
          true,
        );
        t.infiltrated = debit(Math.min(k, (zb.runoffM3 * treated) / zb.areaM2));
      } else if (c.family === "storage") {
        const perf = c.performanceByScenario[scenarioId];
        if (!perf)
          throw new InputError(
            `${c.name}: kapasitas untuk skenario ini belum dinyatakan.`, {componentId:c.id,field:"capacity"},
          );
        const captured = debit(
          get(
            perf.availableStorage,
            "m3/event",
            `${c.name} · ruang tampung tersedia`,
            true,
          ),
        );
        t.reused =
          perf.reuse.mode === "off"
            ? 0
            : Math.min(
                captured,
                get(
                  perf.reuse.demand,
                  "m3/event",
                  `${c.name} · kebutuhan penggunaan kembali`,
                  true,
                ),
              );
        t.stored = captured - t.reused;
      } else {
        const perf = c.performanceByScenario[scenarioId];
        if (!perf)
          throw new InputError(
            `${c.name}: kapasitas untuk skenario ini belum dinyatakan.`, {componentId:c.id,field:"capacity"},
          );
        t.infiltrated = debit(
          get(
            perf.infiltrationCapacity,
            "m3/event",
            `${c.name} · kapasitas infiltrasi`,
            true,
          ),
        );
      }
      t.handled = t.stored + t.reused + t.infiltrated;
      treatments.push(t);
    }
    const sum = (key: "stored" | "reused" | "infiltrated") =>
      treatments.reduce((n, t) => n + t[key], 0);
    const stored = sum("stored"),
      reused = sum("reused"),
      infiltrated = sum("infiltrated");
    const residual = Object.values(remaining).reduce((a, v) => a + v, 0);
    if (
      ![stored, reused, infiltrated, residual, cost, area].every(
        (v) => Number.isFinite(v) && v >= 0,
      ) ||
      Math.abs(b.runoffM3 - stored - reused - infiltrated - residual) >
        1e-9 * Math.max(1, b.runoffM3)
    )
      throw new InputError(
        "Neraca tidak konservatif; hasil tidak dapat digunakan.", {field:"ledger"},
      );
    return {
      ok: true,
      value: {
        scenarioId,
        baseline: b.runoffM3,
        residual,
        stored,
        reused,
        infiltrated,
        cost,
        area,
        budget,
        usableArea,
        components: treatments,
        remainingByZone: remaining,
      },
    };
  } catch (error) {
    if (error instanceof InputError) return invalid(error.message,error.target);
    throw error;
  }
}
export type Alternative = { plan: Plan; balance: PlanBalance };
export function dominates(a: PlanBalance, b: PlanBalance): boolean {
  return (
    a.residual <= b.residual &&
    a.cost <= b.cost &&
    a.area <= b.area &&
    (a.residual < b.residual || a.cost < b.cost || a.area < b.area)
  );
}
function stableId(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)));
}
export function planningInputsReady(p: ProjectV2, scenarioId: string, optionIds = new Set(p.optionGroups.filter(g => g.enabled).flatMap(g => g.choices.filter(c => c.enabled).flatMap(c => c.componentIds)))): Outcome<null> {
  const required = [...new Set([scenarioId, ...p.constraints.requiredScenarioIds])];
  const fail = (message: string, target: Partial<Issue> = {}): Outcome<never> => ({ ok: false, issues: [{ code: "option_space", path: "interventions", message, ...target }] });
  try {
    for (const sid of required) { const base = productionBaseline(p, sid); if (!base.ok) return base; }
    planningParameterValue(p.parameters, p.constraints.budget, "IDR", "Batas anggaran");
    planningParameterValue(p.parameters, p.constraints.usableArea, "m2", "Lahan tersedia");
    for (const id of optionIds) {
      if (!p.components.some(c => c.id === id && c.enabled)) return fail("Pilihan merujuk intervensi yang tidak tersedia.");
    }
    // Individual incomplete candidates are excluded by evaluatePlan, not silently completed.

  } catch (e) {
    if (e instanceof InputError) return fail(e.message, { ...e.target, field: e.target.parameterId === p.constraints.budget.id ? "budget" : e.target.parameterId === p.constraints.usableArea.id ? "land" : e.target.field });
    throw e;
  }
  return { ok: true, value: null };
}

export function optimize(
  p: ProjectV2,
  scenarioId: string,
  onProgress?: (completed: number, total: number) => void,
): Outcome<{
  alternatives: Alternative[];
  declared: number;
  aliases: number;
  invalidCombinations: number;
  evaluated: number;
  rejected: number;
  reasons: { message: string; count: number }[];
  dominated: number;
  excluded: { plan: Plan; reasons: string[] }[];
  superseded: { candidate: Alternative; by: Alternative }[];
}> {
  const fail = (message: string): Outcome<never> => ({
    ok: false,
    issues: [{ code: "option_space", path: "optionGroups", message }],
  });
  if (!projectV2Schema.safeParse(p).success)
    return fail("Proyek atau referensi pilihan tidak valid.");
  const groups = [...p.optionGroups]
    .filter((g) => g.enabled)
    .sort((a, b) => a.id.localeCompare(b.id, "en"))
    .map((g) =>
      [...g.choices]
        .filter((c) => c.enabled)
        .sort((a, b) => a.id.localeCompare(b.id, "en")),
    );
  if ((!groups.length && !p.manualPlans.length) || groups.some((g) => !g.length))
    return fail("Nyatakan kelompok pilihan yang akan diuji.");
  // With no choice groups, evaluate only explicitly saved manual definitions.
  // An empty product must not silently manufacture a baseline alternative.
  const count = groups.length ? groups.reduce((n, g) => n * g.length, 1) : 0;
  const declared = count + p.manualPlans.length;
  if (declared > 10000)
    return fail(
      "Ruang pilihan melebihi 10.000 kombinasi. Kurangi pilihan; tidak ada pemotongan diam-diam.",
    );
  const required = [
    ...new Set([scenarioId, ...p.constraints.requiredScenarioIds]),
  ];
  const optionIds = new Set(
    groups.flatMap((g) => g.flatMap((c) => c.componentIds)),
  );
  const ready = planningInputsReady(p, scenarioId, optionIds);
  if (!ready.ok) return ready;
  const identity = stableId(planningFingerprint({ ...p, optionGroups: [] }));
  const candidates: Alternative[] = [];
  const reasons = new Map<string, number>();
  const excluded: { plan: Plan; reasons: string[] }[] = [];
  const keys = new Map<string, string>();
  let rejected = 0, evaluated = 0, aliases = 0, invalidCombinations = 0;
  for (let index = 0; index < count; index++) {
    if (index % 100 === 0) onProgress?.(index, declared);
    let cursor = index;
    const ids: string[] = [];
    for (const group of groups) {
      const choice = group[cursor % group.length]!;
      cursor = Math.floor(cursor / group.length);
      ids.push(...choice.componentIds);
    }
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !p.components.some((c) => c.id === id && c.enabled))
    ) {
      invalidCombinations++;
      continue;
    }
    const orderedIds = p.components
      .filter((c) => ids.includes(c.id))
      .map((c) => c.id);
    const signature = JSON.stringify(orderedIds),
      id = `alternative-${stableId(identity + signature)}`;
    if (keys.has(id)) {
      if (keys.get(id) !== signature)
        return fail(
          "Identitas alternatif bertabrakan; hasil tidak diterbitkan.",
        );
      aliases++;
      continue;
    }
    keys.set(id, signature);
    const plan = snapshotPlan(
      p,
      orderedIds,
      id,
      `Alternatif ${index + 1}`,
      "optimizer",
    );
    plan.optimizationScenarioId = scenarioId;
    evaluated++;
    const results = required.map((s) => evaluatePlan(p, plan, s));
    if (results.some((r) => !r.ok)) {
      excluded.push({ plan, reasons: results.flatMap((r, i) => r.ok ? [] : r.issues.map(issue => `${p.scenarios.find(s => s.id === required[i])?.name ?? required[i]}: ${issue.message}`)) });
      for (const message of new Set(results.flatMap(r => r.ok ? [] : r.issues.map(i => i.message)))) reasons.set(message, (reasons.get(message) ?? 0) + 1);
      rejected++;
      continue;
    }
    const first = results[0]!;
    if (first.ok) candidates.push({ plan, balance: first.value });
  }
  for (const saved of [...p.manualPlans].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    const plan = structuredClone(saved);
    plan.optimizationScenarioId = scenarioId;
    evaluated++;
    const results = required.map(s => evaluatePlan(p, plan, s));
    if (results.some(r => !r.ok)) {
      const messages = results.flatMap((r, i) => r.ok ? [] : r.issues.map(issue => `${p.scenarios.find(s => s.id === required[i])?.name ?? required[i]}: ${issue.message}`));
      excluded.push({ plan, reasons: messages });
      for (const message of new Set(results.flatMap(r => r.ok ? [] : r.issues.map(i => i.message)))) reasons.set(message, (reasons.get(message) ?? 0) + 1);
      rejected++;
    } else {
      const first = results[0]!;
      if (first.ok) candidates.push({ plan, balance: first.value });
    }
  }
  onProgress?.(declared, declared);
  const alternatives = candidates.filter(
    (c) => !candidates.some((other) => dominates(other.balance, c.balance)),
  );
  const superseded = candidates.flatMap(candidate => {
    const by = alternatives.find(other => dominates(other.balance, candidate.balance));
    return by ? [{ candidate, by }] : [];
  });
  return { ok: true, value: { alternatives, declared, evaluated, aliases, invalidCombinations, rejected, reasons: [...reasons].map(([message, count]) => ({message, count})), dominated: candidates.length - alternatives.length, excluded, superseded } };
}
