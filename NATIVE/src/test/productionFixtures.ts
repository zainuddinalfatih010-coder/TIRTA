import { qualifyScientificFixture } from './scientificFixtures';
import { createProjectV2, type ProjectV2 } from "../domain/projectV2";
import { confirmClassification } from "../domain/classification";
import type { ParameterV2, ReferenceV2 } from "../domain/v2-primitives";
export const testTime = "2026-09-13T00:00:00.000Z";
export function parameter(
  p: ProjectV2,
  id: string,
  value: number | null,
  unit: ParameterV2["unit"],
  evidence: ParameterV2["evidence"] = value === null ? "UNKNOWN" : "ASSUMPTION",
): ReferenceV2 {
  p.parameters.push({
    id,
    revision: 1,
    value,
    unit,
    evidence,
    source: value === null ? "" : "Uji aritmetika mandiri; bukan data pilot",
    note: "",
    applicability: "Skenario pengujian eksplisit",
  });
  return { id, unit, evidence };
}
export function productionFixture(): ProjectV2 {
  let p = createProjectV2("fixture", "Sekolah — pengujian", testTime);
  const area = parameter(p, "parcel-area", 500, "m2"),
    rain = parameter(p, "rain", 50, "mm");
  p.parcel = {
    id: "parcel",
    polygon: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    area,
    areaMethod: { kind: "direct" },
    geometryContext: "schematic",
  };
  for (const [i, surface] of (
    ["roof", "paved", "soil", "vegetation", "porous"] as const
  ).entries()) {
    const x = i * 20,
      id = `zone-${i}`;
    p.zones.push({
      id,
      name: [
        "Atap utama",
        "Halaman beton",
        "Tanah timur",
        "Taman",
        "Paving berpori",
      ][i]!,
      revision: 1,
      surface: null,
      classificationRecordId: null,
      area: parameter(p, `area-${i}`, 100, "m2"),
      areaMethod: { kind: "direct" },
      coefficient: parameter(
        p,
        `c-${i}`,
        [0.8, 0.9, 0.4, 0.2, 0.3][i]!,
        "ratio",
      ),
      polygon: [
        { x, y: 0 },
        { x: x + 20, y: 0 },
        { x: x + 20, y: 100 },
        { x, y: 100 },
      ],
    });
    p = confirmClassification(
      p,
      { projectId: p.id, zoneId: id, zoneRevision: 1 },
      surface,
      null,
      `class-${i}`,
    );
  }
  p.scenarios = [
    {
      id: "rain-50",
      name: "Hujan 50 mm",
      revision: 1,
      rainfall: rain,
      eventWindowNote: "Satu kejadian",
      overrides: [],
    },
    {
      id: "rain-100",
      name: "Hujan 100 mm",
      revision: 1,
      rainfall: parameter(p, "heavy-rain", 100, "mm"),
      eventWindowNote: "Satu kejadian",
      overrides: [],
    },
  ];
  p.installationSites = [
    {
      id: "site",
      name: "Lahan yang dialokasikan",
      availableArea: parameter(p, "site-area", 40, "m2"),
      suitability: "Asumsi uji, bukan kajian teknis",
      evidence: "ASSUMPTION",
      polygon: null,
    },
  ];
  for (let i = 0; i < 8; i++) {
    const family = (
        ["storage", "infiltration", "rain-garden", "permeable"] as const
      )[i % 4]!,
      id = `variant-${i}`;
    const occupiedArea = parameter(p, `${id}-area`, i + 1, "m2"),
      totalCost = parameter(p, `${id}-cost`, (i + 1) * 1000000, "IDR"),
      capacity = parameter(p, `${id}-capacity`, i + 1, "m3/event");
    const common = {
      id,
      name: `Varian ${i + 1}`,
      revision: 1,
      enabled: i !== 7,
      targets: ["zone-0"],
      connectionNote: "Target ditetapkan untuk pengujian",
      installationSiteId: "site",
      occupiedArea,
      totalCost,
      applicability: "Kapasitas kejadian uji",
      excludes: [],
      placement: null,
    };
    const applicability = "Hanya kejadian 50 mm pada fixture ini";
    if (family === "storage")
      p.components.push({
        ...common,
        family,
        performanceByScenario: {
          "rain-50": {
            availableStorage: capacity,
            reuse: { mode: "off" },
            applicability,
          },
        },
      });
    else if (family === "permeable")
      p.components.push({
        ...common,
        family,
        treatedArea: occupiedArea,
        performanceByScenario: {
          "rain-50": {
            additionalInfiltrationCapacity: capacity,
            applicability,
          },
        },
      });
    else
      p.components.push({
        ...common,
        family,
        performanceByScenario: {
          "rain-50": { infiltrationCapacity: capacity, applicability },
        },
      });
  }
  p.optionGroups = [
    {
      id: "tanks",
      name: "Ukuran tangki",
      enabled: true,
      choices: [
        { id: "none", name: "Tanpa tangki", enabled: true, componentIds: [] },
        {
          id: "small",
          name: "Varian 1",
          enabled: true,
          componentIds: ["variant-0"],
        },
        {
          id: "large",
          name: "Varian 5",
          enabled: true,
          componentIds: ["variant-4"],
        },
      ],
    },
  ];
  return qualifyScientificFixture(p);
}
