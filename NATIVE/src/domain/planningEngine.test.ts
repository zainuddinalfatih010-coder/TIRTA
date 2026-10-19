import { qualifyScientificFixture } from '../test/scientificFixtures';
import { describe, expect, it } from "vitest";
import { productionFixture, parameter } from "../test/productionFixtures";
import {
  evaluatePlan,
  snapshotPlan,
  optimize,
  planningFingerprint,
} from "./planningEngine";
import { saveRain, saveComponent, readInput } from "./planningAuthoring";
import { productionBaseline } from "./productionBaseline";

function fixture() {
  const p = productionFixture();
  p.parameters.find((v) => v.id === "parcel-area")!.value = 200;
  for (let i = 0; i < 5; i++)
    p.parameters.find((v) => v.id === `area-${i}`)!.value = 40;
  p.constraints.budget = parameter(p, "budget-test", 20000000, "IDR");
  p.constraints.usableArea = parameter(p, "space-test", 40, "m2");
  for (let i = 0; i < 4; i++) p.components[i]!.targets = [`zone-${i === 3 ? 1 : i}`];
  return p;
}
describe("production event ledger", () => {
  it('does not change scientific identity when storage collections are reordered', () => {
    const p = fixture(), original = planningFingerprint(p), result = optimize(p, 'rain-50');
    p.parameters.reverse();
    p.scenarios.reverse();
    p.installationSites.reverse();
    p.optionGroups.reverse();
    p.optionGroups.forEach(g => g.choices.reverse());
    expect(planningFingerprint(p)).toBe(original);
    const reordered = optimize(p, 'rain-50');
    expect(result.ok && reordered.ok).toBe(true);
    if (result.ok && reordered.ok) expect(reordered.value.alternatives.map(a => a.plan.id)).toEqual(result.value.alternatives.map(a => a.plan.id));
    p.components.reverse();
    expect(planningFingerprint(p)).not.toBe(original);
  });
  it('treats exact rainfall and intervention re-applies as planning no-ops', () => {
    const p = fixture();
    const rain = p.scenarios.find(s => s.id === 'rain-50')!;
    const rainInput = readInput(p, rain.rainfall, rain.id);
    const rainFingerprint = planningFingerprint(p);
    const sameRain = saveRain(p, rain.id, rain.name, rainInput, rain.eventWindowNote);
    expect(sameRain.scenarios.find(s => s.id === rain.id)!.revision).toBe(rain.revision);
    expect(planningFingerprint(sameRain)).toBe(rainFingerprint);

    const inputFor = (project: typeof p) => {
      const tank = project.components.find(c => c.id === 'variant-0')!;
      if (tank.family !== 'storage') throw new Error('fixture');
      const perf = tank.performanceByScenario['rain-50']!;
      return { id:tank.id,name:tank.name,family:tank.family,targets:tank.targets,siteId:tank.installationSiteId!,connection:tank.connectionNote,applicability:perf.applicability,cost:readInput(project,tank.totalCost),area:readInput(project,tank.occupiedArea),scenarioId:'rain-50',capacity:readInput(project,perf.availableStorage,'rain-50'),reuse:null,treatment:tank.treatment,waterUse:tank.waterUse,drawdown:tank.drawdown };
    };
    const normalized = saveComponent(sameRain, inputFor(sameRain));
    const normalizedTank = normalized.components.find(c => c.id === 'variant-0')!;
    const componentFingerprint = planningFingerprint(normalized);
    const repeated = saveComponent(normalized, inputFor(normalized));
    expect(repeated.components.find(c => c.id === 'variant-0')!.revision).toBe(normalizedTank.revision);
    expect(planningFingerprint(repeated)).toBe(componentFingerprint);
  });
  it('separates declared combinations, duplicate aliases and unique evaluations', () => {
    const p = fixture();
    p.optionGroups[0]!.choices.push({ id: 'also-none', name: 'Alias without tank', enabled: true, componentIds: [] });
    const result = optimize(p, 'rain-50');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.value;
    expect(r.declared).toBe(4);
    expect(r.evaluated).toBe(3);
    expect(r.aliases).toBe(1);
    expect(r.invalidCombinations + r.aliases + r.evaluated).toBe(r.declared);
    expect(r.rejected + r.dominated + r.alternatives.length).toBe(r.evaluated);
  });
  it('edits effective rainfall, capacity and reuse overrides without changing the base', () => {
    let p = fixture();
    const rain = p.scenarios[0]!;
    rain.overrides.push({baseParameterId: rain.rainfall.id, replacement: parameter(p, 'rain-override', 60, 'mm')});
    p = saveRain(p, rain.id, rain.name, {text:'70', source:'Scenario assumption', evidence:'ASSUMPTION'}, 'Event');
    expect(p.parameters.find(v => v.id === rain.rainfall.id)!.value).toBe(50);
    expect(readInput(p, rain.rainfall, rain.id).text).toBe('70');
    const tank = p.components[0]!;
    if (tank.family !== 'storage') throw new Error('fixture');
    const perf = tank.performanceByScenario[rain.id]!;
    const demand = parameter(p, 'base-reuse', 0.1, 'm3/event');
    perf.reuse = {mode:'capture-then-reuse', demand};
    p.scenarios[0]!.overrides.push({baseParameterId:perf.availableStorage.id,replacement:parameter(p,'capacity-override',0.4,'m3/event')}, {baseParameterId:demand.id,replacement:parameter(p,'reuse-override',0.2,'m3/event')});
    const updated = saveComponent(p, {id:tank.id,name:tank.name,family:tank.family,targets:tank.targets,siteId:tank.installationSiteId!,connection:tank.connectionNote,applicability:perf.applicability,cost:readInput(p,tank.totalCost),area:readInput(p,tank.occupiedArea),scenarioId:rain.id,capacity:{text:'0.8',source:'Scenario test',evidence:'ASSUMPTION'},reuse:{text:'0.3',source:'Demand test',evidence:'ASSUMPTION'}});
    expect(updated.parameters.find(v => v.id === perf.availableStorage.id)!.value).toBe(1);
    expect(updated.parameters.find(v => v.id === demand.id)!.value).toBe(0.1);
    expect(readInput(updated, perf.availableStorage, rain.id).text).toBe('0.8');
    expect(evaluatePlan(updated,snapshotPlan(updated,[tank.id],'unreviewed','Unreviewed'),rain.id).ok).toBe(false);
    qualifyScientificFixture(updated);
    const result = evaluatePlan(updated,snapshotPlan(updated,[tank.id],'override-plan','Override test'),rain.id);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) { expect(result.value.reused).toBe(0.3); expect(result.value.stored).toBe(0.5); }
  });
  it("accounts for four distinct families, limited by target water; unselected components have no effect", () => {
    const p = fixture(),
      plan = snapshotPlan(
        p,
        p.components.slice(0, 4).map((c) => c.id),
        "manual",
        "Rencana uji",
      );
    const r = evaluatePlan(p, plan, "rain-50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.baseline).toBeCloseTo(5.2);
    expect(r.value.stored).toBe(1);
    expect(r.value.infiltrated).toBeCloseTo(2.6);
    expect(r.value.residual).toBeCloseTo(1.6);
    expect(r.value.cost).toBe(10000000);
    expect(r.value.area).toBe(10);
    expect(r.value.components).toHaveLength(4);
    expect(evaluatePlan(p, plan, "rain-50")).toEqual(r);
    expect(evaluatePlan(p, plan, "rain-100").ok).toBe(false);
  });
  it("cannot double-credit shared targets or refill a tank after reuse", () => {
    const p = fixture();
    p.components[1]!.targets = ["zone-0"];
    const plan = snapshotPlan(
      p,
      ["variant-0", "variant-1"],
      "p",
      "Tank and infiltration",
    );
    const tank = plan.components[0]!;
    if (tank.family !== "storage") throw new Error("fixture");
    const demand = parameter(p, "reuse-demand", 10, "m3/event");
    plan.parameters = structuredClone(p.parameters);
    tank.performanceByScenario["rain-50"]!.reuse = {
      mode: "capture-then-reuse",
      demand,
    };
    const r = evaluatePlan(p, plan, "rain-50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(1);
    expect(r.value.stored).toBe(0);
    expect(r.value.infiltrated).toBeCloseTo(0.6);
    expect(r.value.remainingByZone["zone-0"]).toBe(0);
  });
  it("accepts exact constraints and rejects budget, area, UNKNOWN and provenance mismatches", () => {
    const p = fixture(),
      plan = snapshotPlan(p, ["variant-0"], "p", "Tangki");
    p.parameters.find((v) => v.id === "budget-test")!.value = 1000000;
    p.parameters.find((v) => v.id === "space-test")!.value = 1;
    expect(evaluatePlan(p, plan, "rain-50").ok).toBe(true);
    p.parameters.find((v) => v.id === "budget-test")!.value = 999999;
    expect(evaluatePlan(p, plan, "rain-50").ok).toBe(false);
    p.parameters.find((v) => v.id === "budget-test")!.value = 1000000;
    p.parameters.find((v) => v.id === "space-test")!.value = 0.9;
    expect(evaluatePlan(p, plan, "rain-50").ok).toBe(false);
    p.parameters.find((v) => v.id === "space-test")!.value = 1;
    plan.parameters.find((v) => v.id === "variant-0-capacity")!.source = "";
    expect(evaluatePlan(p, plan, "rain-50").ok).toBe(false);
    plan.parameters.find((v) => v.id === "variant-0-capacity")!.evidence =
      "MEASURED";
    expect(evaluatePlan(p, plan, "rain-50").ok).toBe(false);
  });
  it("evaluates the declared finite space deterministically, without selecting BEST", () => {
    const p = fixture();
    const a = optimize(p, "rain-50");
    expect(a).toEqual(optimize(p, "rain-50"));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.evaluated).toBe(3);
    expect(a.value.alternatives).toHaveLength(3);
    expect(p.selectedPlan).toBeNull();
    p.constraints.requiredScenarioIds = ["rain-100"];
    const b = optimize(p, "rain-50");
    expect(b.ok).toBe(true);
    if (b.ok) { expect(b.value.alternatives).toHaveLength(1); expect(b.value.excluded).toHaveLength(2); }
  });
  it("rejects a declared option space above 10,000 without truncating it", () => {
    const p = fixture();
    p.optionGroups = [0, 1].map((group) => ({
      id: `large-group-${group}`,
      name: `Pilihan ${group}`,
      enabled: true,
      choices: Array.from({ length: 101 }, (_, choice) => ({
        id: `choice-${group}-${choice}`,
        name: `Opsi ${choice}`,
        enabled: true,
        componentIds: [],
      })),
    }));

    const result = optimize(p, "rain-50");

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues[0]?.message).toContain("10.000 kombinasi");
  });
  it("accepts both exact finite-search boundaries and rejects the next combination", () => {
    const search = (count: number) => {
      const p = fixture();
      const factors: Record<number, [number, number]> = {
        9999: [101, 99],
        10000: [100, 100],
        10001: [73, 137],
      };
      p.optionGroups = factors[count]!.map((length, group) => ({
        id: `boundary-${count}-${group}`,
        name: `Pilihan uji batas ${group + 1}`,
        enabled: true,
        choices: Array.from({ length }, (_, choice) => ({
          id: `boundary-${count}-${group}-${choice}`,
          name: `Pilihan ${choice}`,
          enabled: true,
          componentIds: [],
        })),
      }));
      return optimize(p, "rain-50");
    };
    for (const count of [9999, 10000]) {
      const result = search(count);
      expect(result.ok, `declared space ${count} must be evaluated, not truncated`).toBe(true);
      if (result.ok) {
        expect(result.value.declared).toBe(count);
        expect(result.value.aliases + result.value.evaluated).toBe(count);
      }
    }
    const tooLarge = search(10001);
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok)
      expect(tooLarge.issues[0]?.message).toContain("10.000 kombinasi");
  });
  it("updates rainfall from explicit input and keeps UNKNOWN distinct from zero", () => {
    const p = fixture();
    const updated = saveRain(
      p,
      "rain-50",
      "Uji 60 mm",
      { text: "60", source: "Asumsi uji", evidence: "ASSUMPTION" },
      "Satu kejadian",
    );
    const b = productionBaseline(updated, "rain-50");
    expect(b.ok && b.value.runoffM3).toBeCloseTo(6.24);
    const unknown = saveRain(
      updated,
      "rain-50",
      "Belum tahu",
      { text: "", source: "", evidence: "USER_INPUT" },
      "",
    );
    expect(productionBaseline(unknown, "rain-50").ok).toBe(false);
    const zero = saveRain(
      updated,
      "rain-50",
      "Tanpa hujan",
      { text: "0", source: "Uji nol", evidence: "ASSUMPTION" },
      "",
    );
    const z = productionBaseline(zero, "rain-50");
    expect(z.ok && z.value.runoffM3).toBe(0);
  });
  it("tracks capacity overrides, preserves candidate identities and declared order, blocks incomplete search", () => {
    const p = fixture(),
      original = planningFingerprint(p);
    const zero = parameter(p, "capacity-zero", 0, "m3/event");
    const before = planningFingerprint(p);
    p.scenarios[0]!.overrides.push({
      baseParameterId: "variant-0-capacity",
      replacement: zero,
    });
    expect(planningFingerprint(p)).not.toBe(before);
    expect(planningFingerprint(p)).not.toBe(original);
    qualifyScientificFixture(p);
    const a = optimize(p, "rain-50");
    p.optionGroups[0]!.choices.reverse();
    const b = optimize(p, "rain-50");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok)
      expect(a.value.alternatives.map((x) => x.plan.id)).toEqual(
        b.value.alternatives.map((x) => x.plan.id),
      );
    p.components.reverse();
    p.optionGroups = [
      {
        id: "both",
        name: "Both",
        enabled: true,
        choices: [
          {
            id: "on",
            name: "On",
            enabled: true,
            componentIds: ["variant-0", "variant-1"],
          },
        ],
      },
    ];
    const c = optimize(p, "rain-50");
    expect(c.ok && c.value.alternatives[0]?.plan.priority).toEqual([
      "variant-1",
      "variant-0",
    ]);
    p.parameters.find((v) => v.id === "capacity-zero")!.source = "";
    const incomplete = optimize(p, "rain-50");
    expect(incomplete.ok).toBe(true);
    if (incomplete.ok) { expect(incomplete.value.alternatives).toHaveLength(0); expect(incomplete.value.excluded.length).toBeGreaterThan(0); }
  });
  it("rejects overlapping installation allocations", () => {
    const p = fixture();
    p.installationSites[0]!.polygon = structuredClone(p.parcel!.polygon);
    p.installationSites.push({ ...p.installationSites[0]!, id: "second-site" });
    p.components[1]!.installationSiteId = "second-site";
    expect(
      evaluatePlan(
        p,
        snapshotPlan(p, ["variant-0", "variant-1"], "p", "Overlapping"),
        "rain-50",
      ).ok,
    ).toBe(false);
  });
});
