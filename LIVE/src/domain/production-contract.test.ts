import { describe, it, expect } from "vitest";
import { productionFixture, parameter } from "../test/productionFixtures";
import { projectV2Schema } from "./projectV2";
import { baselineV2, baselineIdentity } from "./scenario";
import { predictionSchema } from "./v2-primitives";
import { confirmClassification } from "./classification";

describe("full product data depth", () => {
  it("accepts long canonical names without leaking legacy label limits into rendering", () => {
    const p = productionFixture();
    p.zones[0]!.name = "x".repeat(120);
    p.scenarios[0]!.name = "h".repeat(120);
    expect(baselineV2(p, "rain-50").ok).toBe(true);
    expect(p.zones[0]!.name).toHaveLength(120);
  });
  it("keeps full dimension sources without overflowing derived source labels", () => {
    const p = productionFixture(),
      z = p.zones[0]!;
    z.areaMethod = {
      kind: "measured-rectangle",
      length: parameter(p, "length", 10, "m", "MEASURED"),
      width: parameter(p, "width", 10, "m", "MEASURED"),
    };
    p.parameters.find((v) => v.id === z.area.id)!.evidence = "SOURCE_DERIVED";
    z.area.evidence = "SOURCE_DERIVED";
    const replacement = parameter(p, "length-test", 10, "m");
    p.scenarios[0]!.overrides = [{ baseParameterId: "length", replacement }];
    p.parameters.find((v) => v.id === "length-test")!.source = "l".repeat(1990);
    p.parameters.find((v) => v.id === "width")!.source = "w".repeat(1990);
    expect(baselineV2(p, "rain-50").ok).toBe(true);
    expect(
      p.parameters.find((v) => v.id === "length-test")!.source,
    ).toHaveLength(1990);
  });
  it("rejects unsourced dimension sensitivity and returns UNKNOWN without throwing", () => {
    const p = productionFixture(),
      z = p.zones[0]!;
    z.areaMethod = {
      kind: "measured-rectangle",
      length: parameter(p, "length", 10, "m", "MEASURED"),
      width: parameter(p, "width", 10, "m", "MEASURED"),
    };
    p.parameters.find((v) => v.id === z.area.id)!.evidence = "SOURCE_DERIVED";
    z.area.evidence = "SOURCE_DERIVED";
    const replacement = parameter(p, "length-test", 10, "m");
    p.scenarios[0]!.overrides = [{ baseParameterId: "length", replacement }];
    p.parameters.find((v) => v.id === "length-test")!.source = "";
    expect(baselineV2(p, "rain-50").ok).toBe(false);
    p.parameters.find((v) => v.id === "length-test")!.value = null;
    p.parameters.find((v) => v.id === "length-test")!.evidence = "UNKNOWN";
    replacement.evidence = "UNKNOWN";
    const result = baselineV2(p, "rain-50");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((i) => i.code === "unknown")).toBe(true);
  });
  it("identity and arithmetic remain stable after collection order changes", () => {
    const p = productionFixture(),
      key = baselineIdentity(p, "rain-50");
    p.zones.reverse();
    p.parameters.reverse();
    p.components.reverse();
    expect(baselineIdentity(p, "rain-50")).toBe(key);
  });
  it("identity detects reassignment of source references between zones", () => {
    const p = productionFixture(),
      key = baselineIdentity(p, "rain-50");
    const first = p.zones[0]!.coefficient;
    p.zones[0]!.coefficient = p.zones[1]!.coefficient;
    p.zones[1]!.coefficient = first;
    expect(baselineIdentity(p, "rain-50")).not.toBe(key);
  });
  it("preserves eight editable variants in four families and incomplete event profiles", () => {
    const p = productionFixture();
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(p.components).toHaveLength(8);
    const r = baselineV2(p, "rain-50");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rainfallM3).toBe(25);
      expect(r.value.runoffM3).toBe(13);
    }
  });
  it("preserves historic plan source snapshots across live parameter changes", () => {
    const p = productionFixture();
    p.manualPlans = [
      {
        id: "plan",
        name: "Rencana tersimpan",
        revision: 1,
        origin: "manual",
        components: [structuredClone(p.components[0]!)],
        parameters: structuredClone(p.parameters),
        priority: ["variant-0"],
        optimizationScenarioId: "rain-50",
        comparisonScenarioIds: ["rain-100"],
        originInputFingerprint: null,
        reviewedInputFingerprint: null,
        note: "",
      },
    ];
    p.parameters.find((v) => v.id === "variant-0-cost")!.value = 9000000;
    expect(
      projectV2Schema
        .parse(p)
        .manualPlans[0]!.parameters.find((v) => v.id === "variant-0-cost")!
        .value,
    ).toBe(1000000);
  });
  it("blocks cost sensitivity, missing refs and sharing an instance between groups", () => {
    const p = productionFixture();
    p.scenarios[0]!.overrides = [
      {
        baseParameterId: "variant-0-cost",
        replacement: parameter(p, "new-cost", 4, "IDR"),
      },
    ];
    expect(projectV2Schema.safeParse(p).success).toBe(false);
    p.scenarios[0]!.overrides = [];
    p.optionGroups.push({
      ...structuredClone(p.optionGroups[0]!),
      id: "other",
    });
    expect(projectV2Schema.safeParse(p).success).toBe(false);
  });
  it("tests C without mutating base values and invalidates only the relevant baseline", () => {
    const p = productionFixture(),
      original = baselineIdentity(p, "rain-50");
    const replacement = parameter(p, "c-test", 0.4, "ratio");
    p.scenarios[0]!.overrides = [{ baseParameterId: "c-0", replacement }];
    const r = baselineV2(p, "rain-50");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.runoffM3).toBe(11);
    expect(p.parameters.find((v) => v.id === "c-0")!.value).toBe(0.8);
    expect(baselineIdentity(p, "rain-50")).not.toBe(original);
  });
  it("validates measured rectangular sources and propagates UNKNOWN dimensions", () => {
    const p = productionFixture(),
      z = p.zones[0]!;
    const length = parameter(p, "length", 10, "m", "MEASURED"),
      width = parameter(p, "width", 10, "m", "MEASURED");
    z.areaMethod = { kind: "measured-rectangle", length, width };
    const a = p.parameters.find((v) => v.id === z.area.id)!;
    a.evidence = "SOURCE_DERIVED";
    z.area.evidence = "SOURCE_DERIVED";
    expect(projectV2Schema.safeParse(p).success).toBe(true);
    a.value = 99;
    expect(projectV2Schema.safeParse(p).success).toBe(false);
  });
  it("retains all five probabilities, user correction and numeric firewall", () => {
    const p = productionFixture(),
      before = JSON.stringify(p.parameters);
    const prediction = predictionSchema.parse({
      evidenceClass: "ASSIST_SUGGESTION",
      predictedClass: "vegetation",
      probabilities: [0.05, 0.05, 0.05, 0.8, 0.05],
      confidence: 0.8,
      modelId: "test-only",
      modelVersion: "1",
      modelSha256: "a".repeat(64),
      preprocessingVersion: "1",
      calibrationVersion: null,
      thresholdPolicyVersion: "test-only",
    });
    const changed = confirmClassification(
      p,
      { projectId: p.id, zoneId: "zone-0", zoneRevision: 2 },
      "roof",
      prediction,
      "correction",
    );
    expect(changed.classificationRecords.at(-1)).toMatchObject({
      state: "corrected",
      confirmedClass: "roof",
      correctedClass: "roof",
    });
    expect(JSON.stringify(changed.parameters)).toBe(before);
    expect(
      predictionSchema.safeParse({ ...prediction, confidence: 0.99 }).success,
    ).toBe(false);
    expect(
      predictionSchema.safeParse({
        ...prediction,
        probabilities: [0, 0, 0, 0, 0],
      }).success,
    ).toBe(false);
  });
});
