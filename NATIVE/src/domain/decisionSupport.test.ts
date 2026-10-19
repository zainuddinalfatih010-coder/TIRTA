import { describe, expect, it } from "vitest";
import { demoProject, setActiveComponents } from "../direction/productionBridge";
import { saveComponent, readInput } from "./planningAuthoring";
import { optimize, evaluatePlan, snapshotPlan, planningFingerprint, dominates } from "./planningEngine";
import { alternativeAdvantages, decisionPackage, dominanceExplanation, interventionAdvice, saveDeclaredVariant } from "./decisionSupport";
import { projectV2Schema } from "./projectV2";

const complete = () => setActiveComponents(demoProject(true), ["tank", "soak", "garden", "porous"]);
const required = <T,>(r: { ok: true; value: T } | { ok: false; issues: unknown[] }) => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };

describe("transparent decision support", () => {
  it("shows a real Pareto witness, and never explains non-dominance as rejection", () => {
    const p = complete(), rain = p.scenarios[0]!.id;
    const a = { plan: snapshotPlan(p, ["tank", "soak"], "ts", "Tangki dan resapan"), balance: required(evaluatePlan(p, snapshotPlan(p, ["tank", "soak"], "ts", "TS"), rain)) };
    const b = { plan: snapshotPlan(p, ["garden"], "g", "Taman"), balance: required(evaluatePlan(p, snapshotPlan(p, ["garden"], "g", "Taman"), rain)) };
    expect(dominanceExplanation(a, b)).toContain("Rp2.500.000");
    expect(dominanceExplanation(a, b)).toContain("0,15 m³");
    expect(dominanceExplanation(b, a)).toBeNull();
  });

  it("accounts for every evaluation and reports rejected plans separately from dominated plans", () => {
    const p = complete();
    p.parameters.find(v => v.id === p.constraints.budget.id)!.value = 5_000_000;
    const r = required(optimize(p, p.scenarios[0]!.id));
    expect(r.excluded.length).toBe(r.rejected);
    expect(r.superseded.length).toBe(r.dominated);
    expect(r.rejected + r.dominated + r.alternatives.length).toBe(r.evaluated);
    expect(r.excluded.some(e => e.reasons.some(reason => /anggaran/.test(reason)))).toBe(true);
    r.superseded.forEach(s => expect(dominates(s.by.balance, s.candidate.balance)).toBe(true));
    expect(optimize(p, p.scenarios[0]!.id)).toEqual(optimize(p, p.scenarios[0]!.id));
  });

  it("keeps advice conditional, linked to measured inputs, and does not manufacture capacities", () => {
    const p = complete(), original = structuredClone(p);
    const advice = interventionAdvice(p, p.scenarios[0]!.id);
    expect(advice.ready).toBe(true);
    expect(advice.items[0]!.zoneName).toBe(p.zones[1]!.name);
    expect(advice.items.find(i => i.zoneId === p.zones[3]!.id)!.condition).toContain("tidak otomatis");
    expect(advice.items.find(i => i.zoneId === p.zones[4]!.id)!.choices).not.toContain("permeable");
    expect(p).toEqual(original);
    p.parameters.find(v => v.id === p.scenarios[0]!.rainfall.id)!.value = 0;
    expect(interventionAdvice(p, p.scenarios[0]!.id).items).toEqual([]);
    p.parameters.find(v => v.id === p.scenarios[0]!.rainfall.id)!.value = null;
    expect(interventionAdvice(p, p.scenarios[0]!.id).ready).toBe(false);
  });

  it("conclusions use frozen capacities, expose missing scenarios and do not certify safety", () => {
    const p = complete(), rain = p.scenarios[0]!.id;
    const plan = snapshotPlan(p, ["tank"], "chosen", "Tangki");
    const report = decisionPackage(p, plan, rain);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.summary).toContain("2,55");
    expect(report.summary).toContain("3,72");
    expect(report.checks.join(" ")).toContain("penggunaan / jenis konstruksi dan pemeliharaan belum dicatat");
    expect(report.checks.join(" ")).toContain("tidak menambah kredit");
    expect(report.robustness).toContain("bukan jaminan");
    expect(report.provisional).toBe(true);
    plan.components[0]!.performanceByScenario = {};
    expect(decisionPackage(p, plan, rain).ok).toBe(false);
  });

  it("uses relative advantages without a weighted score or winner", () => {
    const p = complete(), r = required(optimize(p, p.scenarios[0]!.id));
    const baseline = r.alternatives.find(a => a.plan.components.length === 0)!;
    expect(alternativeAdvantages(baseline, r.alternatives).join(" ")).toContain("Biaya paling rendah");
    expect(alternativeAdvantages(baseline, r.alternatives).join(" ")).not.toContain("terbaik");
  });

  it("stores independent declared size variants and evaluates their frozen parameters", () => {
    let p = setActiveComponents(demoProject(true), ["tank"]);
    const rain = p.scenarios[0]!.id;
    p = saveDeclaredVariant(p, rain, "Tangki ukuran awal", "size-original");
    const old = p.manualPlans[0]!;
    const before = required(evaluatePlan(p, old, rain));
    const tank = p.components.find(c => c.id === "tank")!;
    p = saveComponent(p, { id: tank.id, name: tank.name, family: tank.family, targets: tank.targets, siteId: tank.installationSiteId!, connection: tank.connectionNote, applicability: tank.applicability, cost: readInput(p, tank.totalCost), area: readInput(p, tank.occupiedArea), scenarioId: rain, capacity: { text: "1", evidence: "ASSUMPTION", source: "Ukuran uji" }, reuse: null, planningNotes: "Penyiraman setelah hujan oleh petugas" });
    expect(required(evaluatePlan(p, p.manualPlans[0]!, rain))).toEqual(before);
    const search = required(optimize(p, rain));
    expect(search.declared).toBe(3);
    expect([...search.alternatives, ...search.superseded.map(s => s.candidate)].some(a => a.plan.id === "size-original")).toBe(true);
    expect(p.components.find(c => c.id === "tank")!.planningNotes).toContain("Penyiraman");
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(planningFingerprint(p)).not.toBe(planningFingerprint({ ...p, manualPlans: [] }));
  });

  it("retains UNKNOWN and enforces explicitly required additional scenarios", () => {
    const p = complete();
    const second = p.scenarios[1]!.id;
    delete p.components[0]!.performanceByScenario[second];
    expect(optimize(p, p.scenarios[0]!.id).ok).toBe(true);
    p.constraints.requiredScenarioIds = [second];
    const filtered = optimize(p, p.scenarios[0]!.id);
    expect(filtered.ok).toBe(true);
    if (filtered.ok) expect(filtered.value.alternatives.every(a => !a.plan.components.some(c => c.id === p.components[0]!.id))).toBe(true);
    expect(() => saveDeclaredVariant(p, second, "Incomplet", "bad")).toThrow();
  });
});
