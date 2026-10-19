import { describe, it, expect } from "vitest";
import { createProjectV2 } from "./projectV2";
import {
  addShape,
  reshape,
  deleteZone,
  updateShapeData,
  dependencies,
  sharedDataUsers,
  checked,
  type ShapeInput,
} from "./authoring";
import { productionFixture } from "../test/productionFixtures";
import { baselineV2 } from "./scenario";
import { SaveSession } from "../persistence/SaveSession";
import { AuthoringHistory } from "./authoringHistory";
import { parcelReadiness } from "./parcelReadiness";
import { planningFingerprint } from "./planningEngine";
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const blank = {
  value: null,
  evidence: "UNKNOWN" as const,
  source: "",
  note: "",
};
describe("production authoring transactions", () => {
  it("bounds session history and discards redo only after a valid new edit", () => {
    const session = new SaveSession(productionFixture(), async (p) => p, 60000);
    const history = new AuthoringHistory(session);
    for (let i = 1; i <= 105; i++)
      history.apply((p) => ({ ...p, name: `Edit ${i}` }));
    for (let i = 0; i < 100; i++) history.undo();
    expect(session.snapshot().project.name).toBe("Edit 5");
    expect(history.canUndo).toBe(false);
    expect(() => history.apply((p) => ({ ...p, name: "" }))).toThrow();
    expect(history.canRedo).toBe(true);
    history.apply((p) => ({ ...p, name: "New branch" }));
    expect(history.canRedo).toBe(false);
    session.dispose();
  });
  it("identifies shared current sources and leaves historical plan snapshots untouched", () => {
    const p = productionFixture();
    p.manualPlans = [{id:"saved-plan",name:"Rencana tersimpan",revision:1,origin:"manual",components:[structuredClone(p.components[0]!)],parameters:structuredClone(p.parameters),priority:["variant-0"],optimizationScenarioId:"rain-50",comparisonScenarioIds:["rain-100"],originInputFingerprint:null,reviewedInputFingerprint:null,note:""}];
    p.zones[1]!.coefficient = { ...p.zones[0]!.coefficient };
    expect(sharedDataUsers(p, "zone-0")).toContain("Halaman beton");
    const next = updateShapeData(
      p,
      "zone-0",
      {
        name: p.zones[0]!.name,
        surface: "roof",
        method: "direct",
        length: blank,
        width: blank,
        area: {
          ...blank,
          value: 100,
          evidence: "ASSUMPTION",
          source: "Field record",
        },
        coefficient: {
          ...blank,
          value: 0.65,
          evidence: "MEASURED",
          source: "Declared measurement",
        },
      },
      () => "unused",
    );
    expect(next.zones[1]!.coefficient.evidence).toBe("MEASURED");
    expect(
      next.parameters.find((v) => v.id === next.zones[1]!.coefficient.id)!
        .value,
    ).toBe(0.65);
    expect(next.manualPlans).toEqual(p.manualPlans);
    expect(next.manualPlans[0]!.parameters.find(v=>v.id==='c-0')!.value).toBe(.8);
    expect(next.selectedPlan).toEqual(p.selectedPlan);
  });
  it("treats an exact Studio re-apply as a semantic no-op", () => {
    const p = productionFixture();
    const zone = p.zones[0]!;
    const area = p.parameters.find(v => v.id === zone.area.id)!;
    const coefficient = p.parameters.find(v => v.id === zone.coefficient.id)!;
    const beforeFingerprint = planningFingerprint(p);
    const next = updateShapeData(p, zone.id, {
      name: zone.name,
      surface: zone.surface,
      method: "direct",
      area: { value: area.value, evidence: area.evidence, source: area.source, note: area.note },
      coefficient: { value: coefficient.value, evidence: coefficient.evidence, source: coefficient.source, note: coefficient.note },
      length: blank,
      width: blank,
    }, () => "unused-no-op");
    expect(next.zones[0]!.revision).toBe(zone.revision);
    expect(next.parameters.find(v => v.id === area.id)!.revision).toBe(area.revision);
    expect(next.parameters.find(v => v.id === coefficient.id)!.revision).toBe(coefficient.revision);
    expect(planningFingerprint(next)).toBe(beforeFingerprint);
  });
  it("rejects nonfinite reference extents instead of passing invalid image geometry to the world", () => {
    const p = productionFixture();
    p.attachments = [
      {
        id: "image",
        purpose: "underlay",
        mediaType: "image/png",
        byteLength: 10,
        sha256: "a".repeat(64),
        width: 100,
        height: 100,
        source: "Local test",
      },
    ];
    p.underlay = {
      attachmentId: "image",
      context: "schematic",
      x: 0,
      y: 0,
      scale: 1e308,
      opacity: 0.4,
      locked: true,
    };
    expect(() => checked(p)).toThrow("gambar");
  });
  it("uses the baseline source rules for parcel readiness without inventing rainfall", () => {
    const p = productionFixture();
    p.parameters.find(v => v.id === 'parcel-area')!.value = 200;
    for (let i = 0; i < 5; i++) p.parameters.find(v => v.id === `area-${i}`)!.value = 40;
    expect(parcelReadiness(p).issues).toEqual([]);
    const q = structuredClone(p);
    q.scenarios = [];
    expect(parcelReadiness(q).issues).toEqual([]);
    q.parameters.find((v) => v.id === "c-0")!.source = "";
    expect(
      parcelReadiness(q).issues.some((i) => i.field === "coefficient"),
    ).toBe(true);
    expect(baselineV2({ ...q, scenarios: p.scenarios }, "rain-50").ok).toBe(
      false,
    );
  });
  it("keeps unmeasured parcel inputs UNKNOWN alongside explicit test rain defaults, rejects overlap/outside/crossing, and preserves last valid state", () => {
    const p = addShape(
      createProjectV2("p", "Test", "2026-09-13T00:00:00.000Z"),
      "parcel",
      rect(0, 0, 100, 100),
      true,
    );
    const z = addShape(p, "zone", rect(0, 0, 50, 50));
    expect(z.parameters.filter(v=>!z.scenarios.some(s=>s.rainfall.id===v.id)).every(v=>v.value===null)).toBe(true);
    expect(z.scenarios.map(s=>z.parameters.find(v=>v.id===s.rainfall.id)!.value)).toEqual([50,100]);
    expect(() => addShape(z, "bad", rect(25, 25, 50, 50))).toThrow("tumpang");
    expect(() => reshape(z, "parcel", rect(10, 10, 80, 80))).toThrow("Zona 1");
    expect(() =>
      reshape(z, "zone", [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
        { x: 50, y: 0 },
      ]),
    ).toThrow();
    expect(z.zones[0]!.polygon).toEqual(rect(0, 0, 50, 50));
    expect(() => addShape(z, "touch", rect(50, 0, 50, 50))).not.toThrow();
  });
  it("keeps movement independent of science and groups undo/redo in the same save session", () => {
    const fixture = productionFixture();
    const p = reshape(
      fixture,
      "zone-0",
      fixture.zones[0]!.polygon.map((v) => ({
        ...v,
        y: v.y === 0 ? 1 : v.y - 1,
      })),
    );
    const session = new SaveSession(p, async (p) => p, 60000),
      history = new AuthoringHistory(session);
    const science = JSON.stringify(p.parameters);
    history.apply((p) =>
      reshape(
        p,
        "zone-0",
        p.zones[0]!.polygon.map((v) => ({ ...v, y: v.y + 0.001 })),
      ),
    );
    expect(JSON.stringify(session.snapshot().project.parameters)).toBe(science);
    history.undo();
    expect(session.snapshot().project.zones).toEqual(p.zones);
    history.redo();
    expect(history.canUndo).toBe(true);
    session.dispose();
  });
  it("applies sourced dimensions and classification without giving C a default", () => {
    let p = addShape(
      addShape(
        createProjectV2("p", "Test", "2026-09-13T00:00:00.000Z"),
        "parcel",
        rect(0, 0, 100, 100),
        true,
      ),
      "z",
      rect(0, 0, 50, 50),
    );
    let n = 0;
    const data: ShapeInput = {
      name: "Atap rumah",
      surface: "roof",
      area: blank,
      coefficient: blank,
      method: "measured-rectangle",
      length: {
        ...blank,
        value: 12,
        evidence: "MEASURED",
        source: "Pita ukur",
      },
      width: { ...blank, value: 5, evidence: "MEASURED", source: "Pita ukur" },
    };
    p = updateShapeData(p, "z", data, () => `id-${n++}`);
    expect(p.parameters.find((v) => v.id === "z-area")!.value).toBe(60);
    expect(p.parameters.find((v) => v.id === "z-c")!.value).toBeNull();
    expect(p.zones[0]!.classificationRecordId).not.toBeNull();
    expect(() =>
      updateShapeData(
        p,
        "z",
        { ...data, length: { ...data.length, value: 0 }, width: blank },
        () => `id-${n++}`,
      ),
    ).toThrow("positif");
    expect(() =>
      updateShapeData(
        p,
        "z",
        { ...data, width: { ...data.width, source: "" } },
        () => `id-${n++}`,
      ),
    ).toThrow("sumber");
  });
  it("clears a confirmed coefficient when its surface class changes", () => {
    let p = addShape(
      addShape(
        createProjectV2("p", "Test", "2026-09-13T00:00:00.000Z"),
        "parcel",
        rect(0, 0, 100, 100),
        true,
      ),
      "z",
      rect(0, 0, 50, 50),
    );
    const coefficient = {
      ...blank,
      value: 0.85,
      evidence: "ASSUMPTION" as const,
      source: "Pilihan pengguna: C=0.85; Atap",
    };
    const dimensions: ShapeInput = {
      name: "Zona",
      surface: "roof",
      area: blank,
      coefficient,
      method: "direct",
      length: blank,
      width: blank,
    };
    p = updateShapeData(p, "z", { ...dimensions, coefficient: blank }, () => "class-record-roof");
    p = updateShapeData(p, "z", dimensions, () => "class-record-roof-confirmed");
    expect(p.parameters.find((value) => value.id === "z-c")).toMatchObject({
      value: 0.85,
      evidence: "ASSUMPTION",
      source: "Pilihan pengguna: C=0.85; Atap",
    });

    p = updateShapeData(p, "z", { ...dimensions, surface: "paved" }, () => "class-record-paved");
    expect(p.zones[0]!.surface).toBe("paved");
    expect(p.parameters.find((value) => value.id === "z-c")).toMatchObject({
      value: null,
      evidence: "UNKNOWN",
      source: "",
    });
  });
  it("preserves historical targets and source records when explicitly deleting a zone", () => {
    const p = productionFixture();
    const refs = p.parameters;
    expect(dependencies(p, "zone-0").length).toBeGreaterThan(0);
    const next = deleteZone(p, "zone-0");
    expect(next.components).toEqual(p.components);
    expect(next.parameters).toEqual(refs);
    expect(baselineV2(next, "rain-50").ok).toBe(false);
  });
});
