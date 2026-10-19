import { qualifyScientificFixture } from '../test/scientificFixtures';
import { describe, expect, it } from "vitest";
import { demoProject, setActiveComponents } from "../direction/productionBridge";
import { assessPackage, packageRecommendations, parcelPackageTemplates, packageConclusionText } from "./packageRecommendations";
import { evaluatePlan, optimize, snapshotPlan } from "./planningEngine";
import { projectV2Schema } from "./projectV2";
import { saveComponent, readInput } from "./planningAuthoring";
import { componentReference, componentResearch } from "./decisionSupport";
import { productionBaseline } from "./productionBaseline";

const must = <T,>(r: { ok: true; value: T } | { ok: false; issues: unknown[] }): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const complete = () => setActiveComponents(demoProject(true), ["tank", "soak", "garden", "porous"]);

describe("parcel-wide package recommendations", () => {
  it('keeps generic packages conservative without auto-inventing Biopori or pavement conversion targets',()=>{
    const p=complete();
    for(const zone of p.zones)if(zone.surface==='soil'){
      zone.surface='vegetation';
      const record=p.classificationRecords.find(r=>r.id===zone.classificationRecordId)!;
      if(record.origin==='demo')record.class='vegetation';else record.confirmedClass='vegetation';
    }
    const templates=parcelPackageTemplates(p,'r50');
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some(t=>t.options.some(o=>o.biopori||o.family==='permeable'))).toBe(false);
  });
  it("proposes complete packages with declared targets, without manufacturing any engineering inputs", () => {
    const p = complete(), original = structuredClone(p), rain = p.scenarios[0]!.id;
    const templates = parcelPackageTemplates(p, rain);
    expect(templates.map(t => t.name)).not.toContain("Tangki + Biopori");
    expect(templates.some(t => t.options.some(o => o.biopori))).toBe(false);
    expect(templates.some(t => t.options.some(o => o.family === "rain-garden"))).toBe(true);
    expect(productionBaseline(p, rain).ok).toBe(true);
    expect(p).toEqual(original);
    expect(parcelPackageTemplates(p, rain)).toEqual(templates);
  });

  it("evaluates user success separately from Pareto, and offers real replacement packages", () => {
    const p = complete(), rain = p.scenarios[0]!.id;
    const before = must(optimize(p, rain));
    p.planningGoal.target = { metric: "reduction-percent", value: 60, source: "Tujuan pengguna" };
    const search = must(optimize(p, rain));
    expect(search).toEqual(before);
    const tank = snapshotPlan(p, ["tank"], "tank-only", "Tangki");
    const a = assessPackage(p, tank, rain);
    expect(a.status).toBe("not-met");
    expect(a.scenarios[0]!.extraVolume).toBeCloseTo(1.212);
    const packages = packageRecommendations(p, search.alternatives, rain);
    expect(packages.some(a => a.assessment.status === "met" && a.plan.components.length >= 2)).toBe(true);
    const text = packageConclusionText(p, tank, rain, search.alternatives).join(" ");
    expect(text).toContain("Target belum tercapai");
    expect(text).toContain("1,21");
    expect(text).toContain("Tangki atap + Rain garden halaman");
    expect(text).toContain("bukan bukti bebas genangan");
    expect(a.unhandledZones[0]!.volume).toBeGreaterThan(a.unhandledZones.at(-1)!.volume);
    expect(a.checks.join(" ")).toContain("tujuan air tampungan belum dipilih");
  });

  it("checks every required rain and equality without calling a failed scenario robust", () => {
    const p = complete(), rain = p.scenarios[0]!.id, second = p.scenarios[1]!.id;
    const plan = snapshotPlan(p, ["tank", "garden"], "tg", "Tangki + taman");
    const residual = must(evaluatePlan(p, plan, rain)).residual;
    p.planningGoal.target = { metric: "residual-m3", value: residual, source: "Target uji" };
    expect(assessPackage(p, plan, rain).status).toBe("met");
    p.constraints.requiredScenarioIds = [second];
    expect(assessPackage(p, plan, rain).status).toBe("not-met");
    delete plan.components[0]!.performanceByScenario[second];
    expect(assessPackage(p, plan, rain).status).toBe("blocked");
    delete p.planningGoal.target;
    p.constraints.requiredScenarioIds = [];
    expect(assessPackage(p, plan, rain).status).toBe("unknown");
    p.planningGoal.target = { metric: "reduction-percent", value: 50, source: "Tujuan" };
    p.parameters.find(v => v.id === p.scenarios[0]!.rainfall.id)!.value = 0;
    expect(assessPackage(p, plan, rain).status).toBe("blocked");
    qualifyScientificFixture(p);
    const reviewedZero = snapshotPlan(p, ["tank", "garden"], "reviewed-zero", "Explicit zero-event capacity review");
    expect(assessPackage(p, reviewedZero, rain).status).toBe("unknown");
    expect(parcelPackageTemplates(p, rain)).toEqual([]);
  });

  it("rejects a declared unsuitable installation but leaves unknown site suitability conditional", () => {
    const p = complete(), rain = p.scenarios[0]!.id;
    const c = p.components.find(c => c.id === "garden")!;
    c.siteAssessment = { connection: "unknown", infiltration: "no", plantingSpace: "yes", surfaceChange: "unknown", source: "Pemeriksaan tanah setempat oleh pengguna" };
    const r = evaluatePlan(p, snapshotPlan(p, [c.id], "g", "Taman"), rain);
    expect(r.ok).toBe(false);
    const search = must(optimize(p, rain));
    expect(search.alternatives.every(a => !a.plan.components.some(c => c.id === "garden"))).toBe(true);
    expect(search.excluded.some(e => e.reasons.join(" ").includes("tidak cocok untuk infiltrasi"))).toBe(true);
    c.siteAssessment.infiltration = "unknown";
    const plan = snapshotPlan(p, [c.id], "g", "Taman");
    expect(evaluatePlan(p, plan, rain).ok).toBe(true);
    expect(assessPackage(p, plan, rain).checks.join(" ")).toContain("belum diperiksa");
    c.siteAssessment.source = "";
    expect(projectV2Schema.safeParse(p).success).toBe(false);
  });

  it("stores biopori, water use, pore context and target across backups, without reusing well capacities", () => {
    let p = complete();
    const rain = p.scenarios[0]!.id, second = p.scenarios[1]!.id;
    const c = p.components.find(c => c.id === "soak")!;
    p = saveComponent(p, { id: c.id, name: "Biopori", family: "infiltration", targets: c.targets, siteId: c.installationSiteId!, connection: c.connectionNote, applicability: "Hasil uji lokal pengguna, bukan angka universal", cost: readInput(p, c.totalCost), area: readInput(p, c.occupiedArea), capacity: { text: "0.05", source: "Hasil uji volume pada hujan ini", evidence: "USER_INPUT" }, reuse: null, scenarioId: rain, infiltrationType: "biopori" });
    const biopori = p.components.find(c => c.id === "soak")!;
    expect(biopori.performanceByScenario[second]).toBeUndefined();
    expect(componentReference(biopori).url).toContain("37416");
    expect(componentResearch(biopori).relevance).toContain("laboratorium");
    const tank = p.components.find(c => c.family === "storage")!;
    if (tank.family === "storage") { tank.waterUse = "irrigation"; tank.drawdown = "planned"; }
    p.zones.find(z => z.surface === "porous")!.poreType = "manufactured";
    p.planningGoal.target = { metric: "residual-m3", value: 0, source: "Target pengguna" };
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() => projectV2Schema.parse({ ...p, planningGoal: { ...p.planningGoal, target: { metric: "reduction-percent", value: 101, source: "Target" } } })).toThrow();
  });
});
