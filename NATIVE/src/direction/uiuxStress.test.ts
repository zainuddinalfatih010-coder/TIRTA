import { expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { createProjectV2, projectV2Schema } from "../domain/projectV2";
import { addShape, updateShapeData } from "../domain/authoring";
import { saveRain } from "../domain/planningAuthoring";
import { deriveEditedAreas } from "../domain/scaledAreas";
import { dimensionParcel, rectanglePoints } from "./parcelTransactions";
import { demoProject, alternativeSearch, setActiveComponents } from "./productionBridge";
import type { Surface } from "../domain/model";
import { addTreatment } from '../domain/treatmentDesign';
import { qualifyScientificFixture } from '../test/scientificFixtures';

const folder = "evidence/uiux-candidate/fixtures";
const note = "Synthetic UI density fixture, not evidence about a real parcel. ".repeat(12);
const save = (name: string, project: ReturnType<typeof demoProject>) => {
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/${name}.tirta.json`, JSON.stringify({ format: "tirta-project", formatVersion: 1, project: projectV2Schema.parse(project) }));
};
test("density fixtures respect the canonical schema, area, UNKNOWN and scientific option space", () => {
  let p = dimensionParcel(createProjectV2("density-20", "Synthetic density — 20 zona, bukan persil nyata", "2026-10-03T00:00:00Z"), "20", "10");
  p.mode = "demo";
  const surfaces: Surface[] = ["roof", "paved", "soil", "vegetation", "porous"];
  for (let i = 0; i < 20; i++) {
    const x = i % 4 * 5, y = Math.floor(i / 4) * 2;
    p = addShape(p, `density-${i}`, rectanglePoints({ x, y }, { x: x + 5, y: y + 2 }));
    p = updateShapeData(p, `density-${i}`, {
      method: "direct", length: { value: null, evidence: "UNKNOWN", source: "", note: "" }, width: { value: null, evidence: "UNKNOWN", source: "", note: "" },
      name: `Zona ${i + 1} — halaman belajar dan fasilitas bersama yang memiliki nama sangat panjang`, surface: surfaces[i % 5]!,
      area: { ...p.parameters.find(param => param.id === p.zones.at(-1)!.area.id)! },
      coefficient: { value: .4, evidence: "DEMO", source: note, note },
    }, () => crypto.randomUUID());
  }
  p = deriveEditedAreas(p);
  for (let i = 0; i < 6; i++) p = saveRain(p, `density-rain-${i}`, `Skenario ${i + 1} — hujan uji sintetis dan asumsi sangat panjang`, { text: String(i * 30), evidence: "DEMO", source: note }, note);
  // More than the four palette slots are valid canonical instances in imported plans.
  const base = demoProject(true, true);
  for (let i = 0; i < 12; i++) {
    const original = base.components[i % 4]!;
    const c = structuredClone(original); c.id = i < 4 ? original.id : `density-instance-${i}`;
    c.name = `Intervensi ${i + 1} — ${original.name}, kebutuhan pemasangan dan tinjauan lapangan panjang`;
    c.targets = [`density-${i % 20}`]; c.enabled = true;
    c.placement = { point: { x: i % 4 * 5 + 2.5, y: Math.floor(i / 4) * 2 + 1 }, footprint: null, context: "schematic" };
    p.components.push(c);
  }
  p.parameters.push(...base.parameters.filter(param => !p.parameters.some(other => other.id === param.id)));
  p.installationSites = structuredClone(base.installationSites);
  p = projectV2Schema.parse(p);
  expect(p.zones).toHaveLength(20); expect(p.components).toHaveLength(12);
  expect(p.zones.reduce((area, zone) => area + p.parameters.find(param => param.id === zone.area.id)!.value!, 0)).toBe(200);
  save("density-known", p);
  for (const zone of p.zones.filter((_, i) => i % 3 === 0)) {
    const parameter = p.parameters.find(param => param.id === zone.coefficient.id)!;
    parameter.value = null; parameter.evidence = "UNKNOWN"; parameter.source = "";
    zone.coefficient.evidence = "UNKNOWN";
  }
  save("density-unknown", p);
  expect(p.parameters.filter(param => param.value === null).length).toBeGreaterThanOrEqual(7);
  let alternatives = setActiveComponents(demoProject(true), ["tank", "soak", "garden", "porous"]);
  // Keep the dense sixteen-combination exercise using a second declared tank,
  // rather than reviving the retired pilot conversion option.
  const added = addTreatment(alternatives, 'storage', 'r50', 'z0');
  alternatives = added.project;
  alternatives.components.find(c => c.id === added.id)!.treatment = { installationZoneId: null, sharedSourceMode: 'ledger', allocationNote: 'Synthetic remaining-volume order', catchmentReviewed: true };
  alternatives.name = "Synthetic alternatives — long planning name and assumptions";
  alternatives.components.forEach(c => { c.name += " — configuration with a deliberately long object name"; });
  // Deliberately small DEMO capacities avoid saturation; all 16 finite combinations
  // can then exercise the dense UI without bypassing Pareto or feasibility rules.
  alternatives.components.forEach((c, i) => {
    c.connectionNote = note; c.applicability = note;
    for (const [ref, value] of [[c.totalCost, 2 ** i * 100_000], [c.occupiedArea, 2 ** i]] as const) {
      Object.assign(alternatives.parameters.find(p => p.id === ref.id)!, { value, evidence: 'DEMO', source: note }); ref.evidence = 'DEMO';
    }
    Object.values(c.performanceByScenario).forEach(performance => {
      performance.applicability = note;
      const ref = "availableStorage" in performance ? performance.availableStorage : "infiltrationCapacity" in performance ? performance.infiltrationCapacity : performance.additionalInfiltrationCapacity;
      Object.assign(alternatives.parameters.find(p => p.id === ref.id)!, { value: 2 ** i * .01, evidence: 'DEMO', source: note }); ref.evidence = 'DEMO';
    });
  });
  qualifyScientificFixture(alternatives);
  const rows = alternativeSearch(alternatives, "r50").rows;
  expect(rows.length).toBeGreaterThanOrEqual(12);
  save("density-alternatives", alternatives);
});
