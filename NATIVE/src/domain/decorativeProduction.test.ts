import { qualifyScientificFixture } from '../test/scientificFixtures';
import { describe, it, expect } from "vitest";
import { createProjectV2, projectV2Schema } from "./projectV2";
import { addShape, reshape } from "./authoring";
import { deriveEditedAreas } from "./scaledAreas";
import { analysePixels, IMAGE_ALGORITHM, imageObservationSchema } from "./imageObservations";
import { confirmImage } from "./confirmImage";
import { saveRain, writeParameter, saveComponent } from "./planningAuthoring";
import { confirmClassification } from "./classification";
import { productionBaseline } from "./productionBaseline";
import { alternativeSearch, setActiveComponents, initialSnapshot } from "../direction/productionBridge";
import { evaluatePlan } from "./planningEngine";
const rectangle = (w: number, h: number) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
const known = (text: string) => ({ text, evidence: "USER_INPUT" as const, source: "Asumsi yang dinyatakan untuk uji independen" });
function parcel() {
  const p = addShape(createProjectV2("real-project", "Rumah pengguna", "2026-09-20T00:00:00.000Z"), "parcel", rectangle(15, 10), true);
  return projectV2Schema.parse(deriveEditedAreas({ ...p, drawingScale: { metersPerUnit: 1, initialLength: 15, initialWidth: 10, source: "Dimensi dinyatakan pengguna" } }));
}
describe("dimensioned production contract", () => {
  it("starts without demo interventions and labels the two default rains as assumptions", () => {
    const p = initialSnapshot().project;
    expect(p.mode).toBe("real"); expect(p.zones).toEqual([]); expect(p.components).toEqual([]);
    expect(p.parameters.filter(v=>!p.scenarios.some(s=>s.rainfall.id===v.id)).every(v=>v.value===null)).toBe(true);
    expect(p.scenarios.map(s=>p.parameters.find(v=>v.id===s.rainfall.id)!.value)).toEqual([50,100]);
  });
  it("derives area atomically and rejects forged persisted area or invalid shapes", () => {
    const p = addShape(parcel(), "zone", rectangle(15, 10));
    expect(p.parameters.find(v => v.id === p.zones[0]!.area.id)?.value).toBe(150);
    const changed = reshape(p, "zone", [{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 10 }, { x: 0, y: 10 }]);
    expect(changed.parameters.find(v => v.id === changed.zones[0]!.area.id)?.value).toBe(115);
    expect(p.parameters.find(v => v.id === p.zones[0]!.area.id)?.value).toBe(150);
    expect(() => reshape(p, "parcel", rectangle(21, 10))).toThrow(/200/);
    expect(() => reshape(p, "zone", rectangle(16, 10))).toThrow(/batas/);
    expect(() => addShape(p, "overlap", rectangle(2, 2))).toThrow(/tumpang/);
    expect(() => reshape(p, "zone", [{ x: 0, y: 0 }, { x: 15, y: 10 }, { x: 15, y: 0 }, { x: 0, y: 10 }])).toThrow();
    const forged = structuredClone(p); forged.parameters.find(v => v.id === p.zones[0]!.area.id)!.value = 149;
    expect(projectV2Schema.safeParse(forged).success).toBe(false);
    const overridden = saveRain(p, "r", "Uji", known("50"), "Uji hujan");
    const replacement = writeParameter(overridden, "false-area", "m2", known("100"));
    overridden.scenarios[0]!.overrides.push({ baseParameterId: overridden.zones[0]!.area.id, replacement });
    expect(projectV2Schema.safeParse(overridden).success).toBe(false);
  });
  it("retains parameter evidence revisions for unchanged inputs and increments genuine changes", () => {
    const p = parcel();
    const ref = writeParameter(p, "capacity", "m3/event", known("3"));
    const revision = p.parameters.find(v => v.id === ref.id)!.revision;
    writeParameter(p, ref.id, "m3/event", known("3.0"));
    expect(p.parameters.find(v => v.id === ref.id)!.revision).toBe(revision);
    writeParameter(p, ref.id, "m3/event", { ...known("3"), source: "New declared basis" });
    expect(p.parameters.find(v => v.id === ref.id)!.revision).toBe(revision + 1);
    writeParameter(p, ref.id, "m3/event", known("4"));
    expect(p.parameters.find(v => v.id === ref.id)!.revision).toBe(revision + 2);
  });
  it("keeps unrounded polygon area rather than display rounding", () => {
    const p = addShape(parcel(), "tiny", rectangle(1.111, 1.111));
    expect(p.parameters.find(v => v.id === p.zones[0]!.area.id)?.value).toBeCloseTo(1.234321, 12);
  });
  it("runs real inputs through production enumeration, conservation and off/on changes", () => {
    let p = addShape(parcel(), "zone", rectangle(15, 10));
    p = confirmClassification(p, { projectId: p.id, zoneId: "zone", zoneRevision: 1 }, "roof", null, "class");
    p.zones[0]!.coefficient = writeParameter(p, p.zones[0]!.coefficient.id, "ratio", known("0.8"));
    p = saveRain(p, "rain", "Uji 60 mm", known("60"), "Satu kejadian");
    p.constraints.budget = writeParameter(p, p.constraints.budget.id, "IDR", known("1000000"));
    p.constraints.usableArea = writeParameter(p, p.constraints.usableArea.id, "m2", known("2"));
    p.installationSites.push({ id: "site", name: "Ruang tangki", availableArea: p.constraints.usableArea, suitability: "Dinyatakan tersedia", evidence: "USER_INPUT", polygon: null });
    expect(alternativeSearch(p, "rain").declared).toBe(0);
    p = setActiveComponents(p, ["tank"]);
    expect(alternativeSearch(p, "rain").declared).toBe(2);
    expect(alternativeSearch(p, "rain").rows.every(r => !r.optionIds.length)).toBe(true);
    expect(alternativeSearch(p, "rain").excluded.length).toBeGreaterThan(0);
    p = saveComponent(p, { id: "tank", name: "Tangki", family: "storage", targets: ["zone"], siteId: "site", connection: "Talang menuju tangki", applicability: "Kapasitas tersedia pada kejadian ini", cost: known("1000000"), area: known("2"), scenarioId: "rain", capacity: known("3"), reuse: null });
    expect(alternativeSearch(p, "rain").rows.some(r => r.optionIds.includes("tank"))).toBe(true);
    qualifyScientificFixture(p);
    const baseline = productionBaseline(p, "rain");
    expect(baseline.ok && baseline.value.runoffM3).toBeCloseTo(7.2);
    const result = alternativeSearch(p, "rain");
    expect(result).toEqual(alternativeSearch(p, "rain"));
    expect(result.rows).toHaveLength(2);
    const plan = result.rows.find(r => r.optionIds.length)!.plan;
    const evaluated = evaluatePlan(p, plan, "rain");
    expect(evaluated.ok).toBe(true);
    if (evaluated.ok) { expect(evaluated.value.stored).toBe(3); expect(evaluated.value.residual).toBeCloseTo(4.2); }
    const four = setActiveComponents(p, ["tank", "soak", "garden", "biopori"]);
    expect(alternativeSearch(four, "rain").declared).toBe(16);
    expect(alternativeSearch(four, "rain").evaluated).toBe(16);
    expect(alternativeSearch(setActiveComponents(four, ["tank", "soak", "garden"]), "rain").declared).toBe(8);
    expect(setActiveComponents(p, []).components[0]!.enabled).toBe(false);
  });
});
describe("actual colour processing and human confirmation", () => {
  it("computes exact mask and pixel counts, without semantic confidence or m²", () => {
    const pixels = new Uint8ClampedArray([30, 150, 40, 255, 180, 120, 60, 255, 100, 100, 100, 255, 0, 0, 0, 0]);
    const result = analysePixels(pixels, 2, 2);
    expect(result.counts).toEqual({ green: 1, brown: 1, neutral: 1, other: 0, transparent: 1 });
    expect(result.suggestedClass).toBe(null);
    expect(result.mask.slice(0, 4)).toEqual(new Uint8ClampedArray([64, 143, 102, 255]));
    expect(() => analysePixels(pixels, 1, 1)).toThrow();
    expect(analysePixels(new Uint8ClampedArray([30, 150, 40, 255]), 1, 1).suggestedClass).toBe("vegetation");
  });
  it("persists confirm/correct/reject provenance, preserves engineering UNKNOWN, blocks stale or forged evidence", () => {
    const p = addShape(parcel(), "zone", rectangle(15, 10));
    const observation = { id: "image", zoneId: "zone", zoneRevision: 1, algorithm: IMAGE_ALGORITHM, sha256: "a".repeat(64), originalWidth: 1, originalHeight: 1, width: 1, height: 1, counts: { green: 1, brown: 0, neutral: 0, other: 0, transparent: 0 }, suggestedClass: "vegetation" as const, preview: "data:image/png;base64,AAAA", mask: "data:image/png;base64,AAAA", source: "Foto pengguna dan observasi lokasi" };
    const context = { projectId: p.id, zoneId: "zone", zoneRevision: 1 };
    const confirmed = confirmImage(p, context, observation, "vegetation", "confirm");
    expect(confirmed.zones[0]!.surface).toBe("vegetation");
    expect(confirmed.parameters).toEqual(p.parameters);
    const forgedLink = structuredClone(confirmed);
    forgedLink.imageObservations![0]!.classificationRecordId = "absent";
    expect(projectV2Schema.safeParse(forgedLink).success).toBe(false);
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(confirmed))).imageObservations).toEqual(confirmed.imageObservations);
    expect(confirmImage(p, context, observation, "roof", "correct").imageObservations![0]!.state).toBe("corrected");
    expect(confirmImage(p, context, observation, null, "reject").zones).toEqual(p.zones);
    expect(() => confirmImage(confirmed, context, observation, "soil", "stale")).toThrow(/berubah/);
    expect(imageObservationSchema.safeParse({ ...confirmed.imageObservations![0], counts: { ...observation.counts, green: 5 } }).success).toBe(false);
    expect(imageObservationSchema.safeParse({ ...confirmed.imageObservations![0], suggestedClass: "roof" }).success).toBe(false);
  });
  it("drops a coefficient when photo-assisted confirmation changes the class and rejects a forged project context", () => {
    let p = addShape(parcel(), "zone", rectangle(15, 10));
    p = confirmClassification(p, { projectId: p.id, zoneId: "zone", zoneRevision: 1 }, "roof", null, "roof-class");
    p.zones[0]!.coefficient = writeParameter(p, p.zones[0]!.coefficient.id, "ratio", known("0.85"));
    const context = { projectId: p.id, zoneId: "zone", zoneRevision: 2 };
    const observation = { id: "image-change", zoneId: "zone", zoneRevision: 2, algorithm: IMAGE_ALGORITHM, sha256: "b".repeat(64), originalWidth: 1, originalHeight: 1, width: 1, height: 1, counts: { green: 1, brown: 0, neutral: 0, other: 0, transparent: 0 }, suggestedClass: "vegetation" as const, preview: "data:image/png;base64,AAAA", mask: "data:image/png;base64,AAAA", source: "Analisis foto lokal" };
    const updated = confirmImage(p, context, observation, "vegetation", "visual-class");
    expect(updated.zones[0]!.surface).toBe("vegetation");
    expect(updated.parameters.find(v => v.id === updated.zones[0]!.coefficient.id)).toMatchObject({ value: null, evidence: "UNKNOWN", source: "" });
    expect(updated.imageObservations![0]!.state).toBe("confirmed");
    expect(() => confirmImage(p, { ...context, projectId: "different-project" }, observation, "vegetation", "forged-context")).toThrow(/proyek/);
  });
});
