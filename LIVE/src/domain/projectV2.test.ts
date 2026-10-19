import { describe, it, expect } from "vitest";
import { legacyFixture as fixture } from "../test/legacyFixture";
import { createProjectV2, projectV2Schema } from "./projectV2";
import { deleteRainScenario } from "./planningAuthoring";
import { migrateProject } from "./migration";
import { baselineV2, baselineIdentity } from "./scenario";
import { confirmClassification } from "./classification";

describe("production contract", () => {
  it("starts real projects with two explicit removable test-rain scenarios and no hidden site defaults", () => {
    const p = createProjectV2("real", "Sekolah", "2026-09-13T00:00:00.000Z");
    expect(p.parameters.map((x) => x.value)).toEqual([null, null, 50, 100]);
    expect(p.scenarios.map(s => [s.id, s.name])).toEqual([["r50", "Hujan 50 mm"], ["r100", "Hujan 100 mm"]]);
    expect(p.parameters.slice(2).every(parameter => parameter.evidence === "ASSUMPTION" && /bukan data hujan lokasi/i.test(parameter.source))).toBe(true);
    expect(deleteRainScenario(p, "r50").scenarios.map(s => s.id)).toEqual(["r100"]);
    expect(p.components).toEqual([]);
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("pure migration preserves original inputs but requires re-confirming legacy classes", () => {
    const old = fixture();
    const before = JSON.stringify(old);
    const p = migrateProject(old, "2026-09-13T00:00:00.000Z");
    expect(JSON.stringify(old)).toBe(before);
    expect(p.zones[0]?.classificationRecordId).toBeNull();
    expect(baselineV2(p, "event").ok).toBe(false);
    const confirmed = confirmClassification(
      p,
      { projectId: p.id, zoneId: "roof", zoneRevision: 1 },
      "roof",
      null,
      "manual-1",
    );
    const result = baselineV2(confirmed, "event");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.runoffM3).toBe(4);
    expect(confirmed.parameters).toEqual(p.parameters);
    expect(confirmed.zones[0]?.polygon).toEqual(old.zones[0]?.polygon);
  });
  it("rejects newer versions, nonfinite values, mismatched evidence and demo laundering", () => {
    expect(() =>
      migrateProject({ schemaVersion: 99 }, "2026-09-13T00:00:00.000Z"),
    ).toThrow();
    const p = migrateProject(fixture(), "2026-09-13T00:00:00.000Z");
    p.parameters[0]!.value = Infinity;
    expect(projectV2Schema.safeParse(p).success).toBe(false);
    p.parameters[0]!.value = 100;
    p.parameters[0]!.evidence = "DEMO";
    expect(projectV2Schema.safeParse(p).success).toBe(false);
  });
  it("baseline identity ignores sketch/names but includes sources and confirmed classification", () => {
    const p = confirmClassification(
      migrateProject(fixture(), "2026-09-13T00:00:00.000Z"),
      { projectId: "golden", zoneId: "roof", zoneRevision: 1 },
      "roof",
      null,
      "manual-1",
    );
    const key = baselineIdentity(p, "event");
    const changed = structuredClone(p);
    changed.name = "Nama lain";
    changed.zones[0]!.polygon[0]!.x = 1;
    expect(baselineIdentity(changed, "event")).toBe(key);
    changed.parameters[0]!.source = "Sumber diubah";
    expect(baselineIdentity(changed, "event")).not.toBe(key);
    expect(() =>
      confirmClassification(
        p,
        { projectId: "golden", zoneId: "roof", zoneRevision: 1 },
        "soil",
        null,
        "late",
      ),
    ).toThrow(/STALE/);
  });
});
