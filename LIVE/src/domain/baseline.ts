import type { Issue, Outcome, Project } from "./model";
import { parseProject, resolveParameter } from "./validation";

export interface ZoneBalance {
  id: string;
  areaM2: number;
  coefficient: number;
  rainfallM3: number;
  runoffM3: number;
  areaSourceId: string;
  coefficientSourceId: string;
}
export interface Baseline {
  calculationVersion: 1;
  inputKey: string;
  scenarioId: string;
  rainfallMm: number;
  rainfallSourceId: string;
  areaM2: number;
  rainfallM3: number;
  runoffM3: number;
  nonRunoffM3: number;
  unit: "m3/event";
  zones: ZoneBalance[];
}
export function calculateBaseline(
  input: unknown,
  scenarioId: string,
): Outcome<Baseline> {
  const parsed = parseProject(input);
  if (!parsed.ok) return parsed;
  const project = parsed.value;
  const issues: Issue[] = [];
  const fail = (code: string, path: string, message: string) =>
    issues.push({ code, path, message });
  const scenario = project.scenarios.find((item) => item.id === scenarioId);
  if (!scenario)
    return {
      ok: false,
      issues: [
        {
          code: "missing_scenario",
          path: "scenarios",
          message: "Buat atau pilih skenario hujan terlebih dahulu.",
        },
      ],
    };
  if (!project.parcel)
    return {
      ok: false,
      issues: [
        {
          code: "missing_parcel",
          path: "parcel",
          message: "Buat persil terlebih dahulu.",
        },
      ],
    };
  if (!project.zones.length)
    fail(
      "missing_zones",
      "zones",
      "Tambahkan zona permukaan untuk menggambarkan isi persil.",
    );
  const rain = resolveParameter(
    project,
    scenario.rainfall,
    "mm",
    `scenarios.${scenario.id}.rainfall`,
  );
  const parcel = resolveParameter(
    project,
    project.parcel.area,
    "m2",
    "parcel.area",
  );
  if (!rain.ok) issues.push(...rain.issues);
  if (!parcel.ok) issues.push(...parcel.issues);
  else if (parcel.value.value <= 0)
    fail("zero_area", "parcel.area", "Luas persil harus lebih dari nol.");
  const zones: ZoneBalance[] = [];
  for (const zone of [...project.zones].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  )) {
    if (zone.surface === null)
      fail(
        "unconfirmed_class",
        `zones.${zone.id}.surface`,
        `${zone.name}: pilih jenis permukaan.`,
      );
    const area = resolveParameter(
      project,
      zone.area,
      "m2",
      `zones.${zone.id}.area`,
    );
    const coefficient = resolveParameter(
      project,
      zone.coefficient,
      "ratio",
      `zones.${zone.id}.coefficient`,
    );
    if (!area.ok)
      issues.push(
        ...area.issues.map((issue) => ({
          ...issue,
          message: `${zone.name}: luas — ${issue.message}`,
        })),
      );
    if (!coefficient.ok)
      issues.push(
        ...coefficient.issues.map((issue) => ({
          ...issue,
          message: `${zone.name}: koefisien — ${issue.message}`,
        })),
      );
    if (area.ok && area.value.value <= 0)
      fail(
        "zero_area",
        `zones.${zone.id}.area`,
        `${zone.name}: luas harus lebih dari nol.`,
      );
    if (area.ok && coefficient.ok && rain.ok) {
      const rainfallM3 = area.value.value * (rain.value.value / 1000);
      zones.push({
        id: zone.id,
        areaM2: area.value.value,
        coefficient: coefficient.value.value,
        rainfallM3,
        runoffM3: rainfallM3 * coefficient.value.value,
        areaSourceId: area.value.id,
        coefficientSourceId: coefficient.value.id,
      });
    }
  }
  if (issues.length || !rain.ok || !parcel.ok) return { ok: false, issues };
  const areaM2 = zones.reduce((total, zone) => total + zone.areaM2, 0);
  const rainfallM3 = zones.reduce((total, zone) => total + zone.rainfallM3, 0);
  const runoffM3 = zones.reduce((total, zone) => total + zone.runoffM3, 0);
  if (![areaM2, rainfallM3, runoffM3].every(Number.isFinite))
    return {
      ok: false,
      issues: [
        {
          code: "overflow",
          path: "parameters",
          message:
            "Angka terlalu besar untuk perhitungan. Periksa satuan dan nilainya.",
        },
      ],
    };
  if (
    Math.abs(areaM2 - parcel.value.value) >
    1e-9 * Math.max(1, parcel.value.value)
  )
    return {
      ok: false,
      issues: [
        {
          code: "area_coverage",
          path: "parcel.area",
          message:
            "Jumlah luas zona belum sama dengan luas persil. Periksa pembagian luas sebelum menghitung seluruh persil.",
        },
      ],
    };
  return {
    ok: true,
    value: {
      calculationVersion: 1,
      inputKey: baselineKey(project, scenarioId),
      scenarioId,
      rainfallMm: rain.value.value,
      rainfallSourceId: rain.value.id,
      areaM2,
      rainfallM3,
      runoffM3,
      nonRunoffM3: rainfallM3 - runoffM3,
      unit: "m3/event",
      zones,
    },
  };
}
export function baselineKey(project: Project, scenarioId: string): string {
  const scenario = project.scenarios.find((item) => item.id === scenarioId);
  const references = [
    project.parcel?.area,
    scenario?.rainfall,
    ...project.zones.flatMap((zone) => [zone.area, zone.coefficient]),
  ];
  const ids = new Set(references.map((reference) => reference?.id));
  return JSON.stringify(
    canonical({
      version: 1,
      projectId: project.id,
      mode: project.mode,
      scenarioId,
      rainfall: scenario?.rainfall ?? null,
      parcel: project.parcel,
      zones: [...project.zones]
        .sort((a, b) => a.id.localeCompare(b.id, "en"))
        .map(({ name: _name, ...zone }) => {
          void _name;
          return zone;
        }),
      parameters: project.parameters
        .filter((p) => ids.has(p.id))
        .sort((a, b) => a.id.localeCompare(b.id, "en")),
    }),
  );
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function isBaselineStale(
  result: Baseline,
  project: Project,
  scenarioId: string,
): boolean {
  return result.inputKey !== baselineKey(project, scenarioId);
}
