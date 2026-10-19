import { calculateBaseline } from "../domain/baseline";
import {
  ref,
  type Parameter,
  type Project,
  type Point,
  type Surface,
} from "../domain/model";

export const titles = [
  "Gedung belajar",
  "Halaman kegiatan",
  "Kebun sekolah",
  "Lahan terbuka",
  "Jalur berpori",
];
export const surfaces: Surface[] = [
  "roof",
  "paved",
  "vegetation",
  "soil",
  "porous",
];
export const colors: Record<Surface, string> = {
  roof: "#b9b1a6",
  paved: "#d8d7ce",
  vegetation: "#a1ba91",
  soil: "#d6b594",
  porous: "#acbabc",
};
export const polygons: Point[][] = [
  [
    { x: 125, y: 110 },
    { x: 400, y: 110 },
    { x: 400, y: 190 },
    { x: 325, y: 190 },
    { x: 325, y: 300 },
    { x: 125, y: 300 },
  ],
  [
    { x: 130, y: 335 },
    { x: 435, y: 335 },
    { x: 435, y: 470 },
    { x: 130, y: 470 },
  ],
  [
    { x: 435, y: 110 },
    { x: 690, y: 110 },
    { x: 690, y: 300 },
    { x: 435, y: 300 },
  ],
  [
    { x: 480, y: 340 },
    { x: 690, y: 340 },
    { x: 690, y: 470 },
    { x: 480, y: 470 },
  ],
  [
    { x: 130, y: 505 },
    { x: 690, y: 505 },
    { x: 690, y: 555 },
    { x: 130, y: 555 },
  ],
];
export const centers = [
  { x: 222, y: 216 },
  { x: 282, y: 405 },
  { x: 562, y: 205 },
  { x: 585, y: 405 },
  { x: 410, y: 531 },
];
export function conceptProject(): Project {
  const p = (
    id: string,
    value: number | null,
    unit: Parameter["unit"],
  ): Parameter => ({
    id,
    value,
    unit,
    evidence: value === null ? "UNKNOWN" : "DEMO",
    source:
      value === null
        ? ""
        : "Skenario sintetis untuk membandingkan konsep antarmuka; bukan hasil survei.",
    note: "Bukan data persil nyata.",
  });
  const areas = [360, 240, 150, 90, 60];
  const coefficients = [0.9, 0.8, 0.2, null, 0.4];
  const total = p("parcel-area", 900, "m2");
  const parameters: Parameter[] = [total];
  const zones = titles.map((name, i) => {
    const area = p(`area-${i}`, areas[i] ?? null, "m2");
    const coefficient = p(`c-${i}`, coefficients[i] ?? null, "ratio");
    parameters.push(area, coefficient);
    return {
      id: `z${i}`,
      name,
      surface: surfaces[i] ?? null,
      polygon: polygons[i] ?? [],
      area: ref(area),
      coefficient: ref(coefficient),
    };
  });
  const scenarios = [50, 80, 120].map((mm) => {
    const rain = p(`rain-${mm}`, mm, "mm");
    parameters.push(rain);
    return { id: `r${mm}`, name: `Uji ${mm} mm`, rainfall: ref(rain) };
  });
  return {
    schemaVersion: 1,
    id: "concept-school",
    name: "Sekolah di antara hujan",
    mode: "demo",
    parcel: {
      area: ref(total),
      polygon: [
        { x: 85, y: 65 },
        { x: 735, y: 65 },
        { x: 735, y: 600 },
        { x: 85, y: 600 },
      ],
    },
    parameters,
    zones,
    scenarios,
  };
}
export function setCoefficient(
  project: Project,
  id: string,
  value: number | null,
): Project {
  const parameter = project.parameters.find((p) => p.id === `c-${id.slice(1)}`);
  if (!parameter) return project;
  const next: Parameter = {
    ...parameter,
    value,
    evidence: value === null ? "UNKNOWN" : "DEMO",
    source:
      value === null
        ? ""
        : "Asumsi demo yang dikonfirmasi pengguna; bukan nilai otomatis dari kelas permukaan.",
  };
  return {
    ...project,
    parameters: project.parameters.map((p) => (p.id === next.id ? next : p)),
    zones: project.zones.map((z) =>
      z.id === id ? { ...z, coefficient: ref(next) } : z,
    ),
  };
}
export const demoOptions = [
  {
    id: "tank",
    name: "Tangki",
    target: "z0",
    targetName: titles[0],
    capacity: 6,
    cost: 5_000_000,
    area: 3,
    disposition: "Tertampung",
  },
  {
    id: "garden",
    name: "Taman hujan",
    target: "z1",
    targetName: titles[1],
    capacity: 9,
    cost: 7_000_000,
    area: 18,
    disposition: "Terinfiltrasi",
  },
] as const;
export type OptionId = (typeof demoOptions)[number]["id"];
export function evaluateDemo(
  project: Project,
  scenario: string,
  enabled: readonly OptionId[],
) {
  const baseline = calculateBaseline(project, scenario);
  if (!baseline.ok) return null;
  const options = demoOptions.filter((o) => enabled.includes(o.id));
  const handled = options.reduce(
    (sum, o) =>
      sum +
      Math.min(
        o.capacity,
        baseline.value.zones.find((z) => z.id === o.target)?.runoffM3 ?? 0,
      ),
    0,
  );
  return {
    baseline: baseline.value,
    residual: baseline.value.runoffM3 - handled,
    handled,
    cost: options.reduce((sum, o) => sum + o.cost, 0),
    area: options.reduce((sum, o) => sum + o.area, 0),
  };
}
export const number = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
