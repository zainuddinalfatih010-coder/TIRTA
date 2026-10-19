import { describe, expect, it } from "vitest";
import { coefficientGuidance, coefficientPicks, coefficientChoiceSource, outsideGuidance } from "./coefficientGuidance";
import { observeVisualFeatures, visualCandidates } from "./visualFeatures";
import { analysePixels } from "./imageObservations";
import { workflowReadiness, forwardIssues } from "./workflowReadiness";
import { alternativeSearch, demoProject, setActiveComponents } from "../direction/productionBridge";
import { saveRain, writeParameter } from "./planningAuthoring";
import { planningFingerprint } from "./planningEngine";
import { imageContext } from "./imageContext";
import { reshape } from "./authoring";

const ready = (p = demoProject(true)) => workflowReadiness(p, p.scenarios[0]!.id, alternativeSearch(p, p.scenarios[0]!.id));
describe("explicit coefficient assistance", () => {
  it("has exactly five classes and preserves contextual primary-source ranges", () => {
    expect(Object.keys(coefficientGuidance)).toHaveLength(5);
    expect(coefficientGuidance.roof.ranges[0]).toEqual({ label: "Atap", low: .75, high: .95 });
    expect(coefficientGuidance.paved.ranges.map(r => [r.low, r.high])).toEqual([[.85, .95], [.9, .95]]);
    expect(coefficientGuidance.soil.ranges[0]!.label).toContain("0–3%");
    expect(coefficientGuidance.vegetation.ranges[0]!.low).toBe(.05);
    expect(coefficientGuidance.porous.ranges).toEqual([]);
    expect(coefficientGuidance.porous.url).toContain("sir20185037");
  });
  it("declares arithmetic midpoints and provenance, keeps valid out-of-guide input possible", () => {
    const range = coefficientGuidance.roof.ranges[0]!;
    expect(coefficientPicks(range).map(p => p.value)).toEqual([.75, .85, .95]);
    expect(coefficientChoiceSource("roof", range, .85)).toContain("bukan kalibrasi");
    expect(outsideGuidance("roof", .4)).toBe(true);
    expect(outsideGuidance("porous", .4)).toBe(false);
    const p = demoProject(true);
    expect(writeParameter(p, p.zones[0]!.coefficient.id, "ratio", { text: "0.4", evidence: "USER_INPUT", source: "Pengukuran khusus" }).evidence).toBe("USER_INPUT");
  });
});
describe("workflow readiness", () => {
  it("distinguishes unmodelled area from completed zone fields without inventing a remainder zone", () => {
    const original = demoProject(true), z = original.zones[0]!;
    const p = reshape(original, z.id, z.polygon.map(v => ({ ...v, x: v.x / 2 })));
    const before = JSON.stringify(p), issues = ready(p).rain;
    expect(issues).toHaveLength(1);
    expect(issues[0]!.field).toBe("coverage");
    expect(issues[0]!.message).toContain("30 m² belum menjadi zona (170 dari 200 m² terwakili)");
    expect(JSON.stringify(p)).toBe(before);
    expect(p.zones).toHaveLength(original.zones.length);
    expect(ready(original).rain).toEqual([]);
  });
  it("reports every incomplete zone and never mutates unknown inputs", () => {
    const p = demoProject(true);
    for (const z of p.zones.slice(0, 2)) {
      z.surface = null; z.classificationRecordId = null;
      z.coefficient = writeParameter(p, z.coefficient.id, "ratio", { text: "", source: "", evidence: "UNKNOWN" });
    }
    const before = JSON.stringify(p), issues = ready(p);
    expect(issues.rain.filter(i => i.field === "coefficient")).toHaveLength(2);
    expect(issues.rain.filter(i => i.field === "surface")).toHaveLength(2);
    expect(issues.rain[0]!.zoneId).toBe(p.zones[0]!.id);
    expect(JSON.stringify(p)).toBe(before);
    expect(forwardIssues("studio", "rain", issues)).not.toHaveLength(0);
    expect(forwardIssues("rain", "studio", issues)).toEqual([]);
  });
  it("blocks invalid geometry and provenance mismatch independently of visible fields", () => {
    const p = demoProject(true); p.zones[0]!.polygon[0] = { x: -50, y: -50 };
    expect(ready(p).rain.some(i => i.field === "geometry")).toBe(true);
    const q = demoProject(true); q.zones[0]!.coefficient.evidence = "MEASURED";
    expect(ready(q).rain.some(i => i.field === "coefficient")).toBe(true);
  });
  it("separates Studio from rainfall, blank from 0, and selected plan from stale plan", () => {
    let p = demoProject(true); const sid = p.scenarios[0]!.id;
    p = saveRain(p, sid, "Test", { text: "", source: "", evidence: "UNKNOWN" }, "Uji");
    expect(ready(p).rain).toEqual([]); expect(ready(p).interventions).not.toHaveLength(0);
    p = saveRain(p, sid, "Test", { text: "0", source: "Uji tanpa hujan", evidence: "USER_INPUT" }, "Uji");
    expect(ready(p).interventions).toEqual([]);
    p = demoProject(true);
    const result = alternativeSearch(p, p.scenarios[0]!.id);
    p.selectedPlan = { definition: result.rows[0]!.plan, reviewedInputFingerprint: planningFingerprint(p), decisionNote: "Pilihan pengguna" };
    expect(ready(p).impact).toEqual([]);
    p.parameters.find(x => x.id === p.constraints.budget.id)!.value! += 1;
    expect(ready(p).impact[0]!.message).toContain("Data berubah");
  });
  it("allows explicit zero-selection, gates only missing selected configuration and preserves infeasible search", () => {
    const p = setActiveComponents(demoProject(true), []);
    expect(ready(p).alternatives).toEqual([]); expect(ready(p).compare).not.toHaveLength(0);
    const q = setActiveComponents(p, ["tank"]);
    q.components.find(c => c.id === "tank")!.targets = [];
    expect(ready(q).alternatives).toEqual([]);
    const partial = alternativeSearch(q, q.scenarios[0]!.id);
    expect(partial.rows.every(r => !r.optionIds.includes("tank"))).toBe(true);
    expect(partial.excluded.some(r => r.plan.components.some(c => c.id === "tank"))).toBe(true);
    const r = demoProject(true);
    r.parameters.find(x => x.id === r.constraints.budget.id)!.value = 0;
    expect(ready(r).alternatives).toEqual([]);
  });
});
describe("local observable image features", () => {
  const pixels = (pattern: (x: number, y: number) => number[]) => new Uint8ClampedArray(Array.from({ length: 1024 }, (_, i) => pattern(i % 32, Math.floor(i / 32))).flat());
  it("measures histogram, saturation, edges and repeating contrast deterministically", () => {
    const flat = pixels(() => [128, 128, 128, 255]);
    const f = observeVisualFeatures(flat, 32, 32);
    expect(f.midPixels).toBe(1024); expect(f.meanSaturation).toBe(0); expect(f.edgeDensity).toBe(0); expect(f.repetition).toBeNull();
    const stripes = pixels((x) => x % 4 < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]);
    const a = observeVisualFeatures(stripes, 32, 32);
    expect(a).toEqual(observeVisualFeatures(stripes, 32, 32));
    expect(a.darkPixels).toBe(512); expect(a.brightPixels).toBe(512); expect(a.edgeDensity).toBeGreaterThan(.2); expect(a.repetition?.lag).toBe(4);
    expect(a).not.toHaveProperty("confidence"); expect(a).not.toHaveProperty("area");
  });
  it("returns tied weak material hypotheses, ranks only defensible observed cues", () => {
    const gray = pixels(() => [128, 128, 128, 255]);
    expect(visualCandidates(analysePixels(gray, 32, 32).counts, observeVisualFeatures(gray, 32, 32)).filter(c => ["roof", "paved", "porous"].includes(c.surface)).every(c => c.level === "Indikasi lemah")).toBe(true);
    const green = pixels(() => [40, 140, 50, 255]);
    expect(visualCandidates(analysePixels(green, 32, 32).counts, observeVisualFeatures(green, 32, 32))[0]?.surface).toBe("vegetation");
    const transparent = pixels(() => [0, 255, 0, 0]);
    expect(visualCandidates(analysePixels(transparent, 32, 32).counts, observeVisualFeatures(transparent, 32, 32)).every(c => c.level === "Belum cukup bukti visual")).toBe(true);
  });
  it("uses real context, refuses infiltration inference and avoids double credit", () => {
    const p = demoProject(true), sid = p.scenarios[0]!.id;
    expect(imageContext(p, "z0", sid, "roof").reason).toContain("m³ limpasan");
    expect(imageContext(p, "z0", sid, "soil").reason).toContain("tidak membuktikan");
    expect(imageContext(p, "z0", sid, "porous").reason).toContain("kredit ganda");
    const unknown = saveRain(p, sid, "Unknown", { text: "", source: "", evidence: "UNKNOWN" }, "");
    expect(imageContext(unknown, "z0", sid, "roof").facts).toContain("Kontribusi limpasan belum tersedia; lengkapi model dan hujan bersumber.");
  });
});
