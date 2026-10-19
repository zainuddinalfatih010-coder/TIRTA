import { z } from "zod";
import { calculateBaseline } from "../domain/baseline";
import {
  projectSchema,
  ref,
  type Project,
  type Parameter,
} from "../domain/model";
import { conceptProject } from "../concepts/data";

export const fmt = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
export const money = (value: number) => `Rp${fmt(value / 1_000_000)} jt`;
export const source =
  "Data demo sintetis untuk eksplorasi; bukan pengukuran sekolah nyata.";
export function demoProject(complete = false): Project {
  let p = {
    ...conceptProject(),
    id: "integrated-school",
    name: "Sekolah Taman Sari",
  };
  if (complete) p = updateParameter(p, "c-3", 0.3);
  return p;
}
export function updateParameter(
  project: Project,
  id: string,
  value: number | null,
  origin = source,
): Project {
  const old = project.parameters.find((p) => p.id === id);
  if (!old) return project;
  const next: Parameter = {
    ...old,
    value,
    evidence: value === null ? "UNKNOWN" : "DEMO",
    source: value === null ? "" : origin,
  };
  return {
    ...project,
    parameters: project.parameters.map((p) => (p.id === id ? next : p)),
    zones: project.zones.map((z) => ({
      ...z,
      area: z.area.id === id ? ref(next) : z.area,
      coefficient: z.coefficient.id === id ? ref(next) : z.coefficient,
    })),
    scenarios: project.scenarios.map((s) => ({
      ...s,
      rainfall: s.rainfall.id === id ? ref(next) : s.rainfall,
    })),
  };
}
export const options = [
  {
    id: "tank",
    name: "Tangki atap",
    family: "Tangki",
    target: "z0",
    targetName: "Gedung belajar",
    capacity: 6,
    cost: 5_000_000,
    area: 3,
    disposition: "retained",
    mark: "T",
  },
  {
    id: "garden",
    name: "Taman hujan halaman",
    family: "Rain garden / taman hujan",
    target: "z1",
    targetName: "Halaman kegiatan",
    capacity: 9,
    cost: 7_000_000,
    area: 18,
    disposition: "infiltrated",
    mark: "H",
  },
] as const;
export type OptionId = (typeof options)[number]["id"];
export const packages: {
  id: "none" | "tank" | "garden" | "both";
  name: string;
  optionIds: OptionId[];
  description: string;
}[] = [
  {
    id: "none",
    name: "Kondisi awal",
    optionIds: [],
    description: "Tanpa intervensi",
  },
  {
    id: "tank",
    name: "Tampung dari atap",
    optionIds: ["tank"],
    description: "Tangki atap",
  },
  {
    id: "garden",
    name: "Resapkan dari halaman",
    optionIds: ["garden"],
    description: "Taman hujan",
  },
  {
    id: "both",
    name: "Tampung + resapkan",
    optionIds: ["tank", "garden"],
    description: "Tangki dan taman hujan",
  },
];
export interface Limits {
  budget: number | null;
  land: number | null;
}
export function evaluate(
  project: Project,
  scenario: string,
  ids: readonly OptionId[],
  limits: Limits,
) {
  if (
    [limits.budget, limits.land].some(
      (n) => n !== null && (!Number.isFinite(n) || n < 0),
    )
  )
    return null;
  const baseline = calculateBaseline(project, scenario);
  if (!baseline.ok) return null;
  const selected = options.filter((o) => ids.includes(o.id));
  let retained = 0,
    infiltrated = 0;
  for (const option of selected) {
    const zone = baseline.value.zones.find((z) => z.id === option.target);
    const surface = project.zones.find((z) => z.id === option.target)?.surface;
    // This prototype declares two disjoint catchments only. No proximity allocation.
    if (
      !zone ||
      (option.id === "tank" && surface !== "roof") ||
      (option.id === "garden" && surface !== "paved")
    )
      return null;
    const credited = Math.min(option.capacity, zone.runoffM3);
    if (option.disposition === "retained") retained += credited;
    else infiltrated += credited;
  }
  const cost = selected.reduce((n, o) => n + o.cost, 0);
  const area = selected.reduce((n, o) => n + o.area, 0);
  const reasons: string[] = [];
  if (limits.budget === null) reasons.push("Batas biaya belum diketahui");
  else if (cost > limits.budget)
    reasons.push(`Melebihi biaya ${money(cost - limits.budget)}`);
  if (limits.land === null) reasons.push("Lahan tersedia belum diketahui");
  else if (area > limits.land)
    reasons.push(`Melebihi lahan ${fmt(area - limits.land)} m²`);
  return {
    baseline: baseline.value,
    retained,
    infiltrated,
    reused: 0,
    residual: baseline.value.runoffM3 - retained - infiltrated,
    cost,
    area,
    feasible: reasons.length === 0,
    reasons,
  };
}
export type Evaluation = NonNullable<ReturnType<typeof evaluate>>;
export function dominates(a: Evaluation, b: Evaluation) {
  return (
    a.residual <= b.residual &&
    a.cost <= b.cost &&
    a.area <= b.area &&
    (a.residual < b.residual || a.cost < b.cost || a.area < b.area)
  );
}
export function alternatives(
  project: Project,
  scenario: string,
  limits: Limits,
) {
  const rows = packages.map((p) => ({
    ...p,
    result: evaluate(project, scenario, p.optionIds, limits),
  }));
  return rows.map((row) => ({
    ...row,
    nonDominated:
      !!row.result?.feasible &&
      !rows.some(
        (other) =>
          other.result?.feasible &&
          row.result &&
          dominates(other.result, row.result),
      ),
  }));
}
export const snapshotSchema = z
  .strictObject({
    version: z.literal(1),
    project: projectSchema,
    scenario: z.string(),
    draft: z.array(z.enum(["tank", "garden"])).max(2),
    chosen: z.enum(["none", "tank", "garden", "both"]).nullable(),
    limits: z.strictObject({
      budget: z.number().finite().nonnegative().nullable(),
      land: z.number().finite().nonnegative().nullable(),
    }),
  })
  .superRefine((s, ctx) => {
    if (
      s.project.mode !== "demo" ||
      !s.project.scenarios.some((r) => r.id === s.scenario) ||
      new Set(s.draft).size !== s.draft.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Berkas prototipe tidak sesuai.",
      });
  });
export type Snapshot = z.infer<typeof snapshotSchema>;
export function initialSnapshot(): Snapshot {
  return {
    version: 1,
    project: demoProject(),
    scenario: "r50",
    draft: ["tank", "garden"],
    chosen: null,
    limits: { budget: 12_000_000, land: 24 },
  };
}
export const storageKey = "tirta-integrated-prototype-v1";
