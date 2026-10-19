import { describe, expect, it } from "vitest";
import { baselineKey, calculateBaseline, isBaselineStale } from "./baseline";
import { emptyProject, ref } from "./model";
import type { Parameter, Project } from "./model";

export function fixture(area = 100, rain = 50, coefficient = 0.8): Project {
  const known = (
    id: string,
    value: number,
    unit: Parameter["unit"],
  ): Parameter => ({
    id,
    value,
    unit,
    evidence: "ASSUMPTION",
    source: "Golden fixture, hitung tangan",
    note: "",
  });
  const a = known("area", area, "m2"),
    r = known("rain", rain, "mm"),
    c = known("c", coefficient, "ratio");
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  return {
    ...emptyProject("golden", "Uji tangan"),
    parcel: { area: ref(a), polygon },
    parameters: [a, r, c],
    zones: [
      {
        id: "roof",
        name: "Atap uji",
        surface: "roof",
        area: ref(a),
        coefficient: ref(c),
        polygon,
      },
    ],
    scenarios: [{ id: "event", name: "Hujan uji", rainfall: ref(r) }],
  };
}

describe("independent golden event balance", () => {
  it.each([
    [100, 50, 0.8, 5, 4],
    [100, 0, 0.8, 0, 0],
    [100, 50, 0, 5, 0],
    [100, 50, 1, 5, 5],
    [12.5, 8, 0.3, 0.1, 0.03],
    [1, 1000, 1, 1, 1],
  ])(
    "area %s × rain %s × C %s gives %s water and %s runoff",
    (a, r, c, water, runoff) => {
      const result = calculateBaseline(fixture(a, r, c), "event");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rainfallM3).toBeCloseTo(water, 12);
        expect(result.value.runoffM3).toBeCloseTo(runoff, 12);
        expect(result.value.nonRunoffM3).toBeCloseTo(water - runoff, 12);
        expect(result.value.unit).toBe("m3/event");
      }
    },
  );
  it("sums multiple zones without using surface class as coefficient", () => {
    const p = fixture();
    const secondArea: Parameter = {
      ...p.parameters[0]!,
      id: "secondArea",
      value: 50,
    };
    const secondC: Parameter = {
      ...p.parameters[2]!,
      id: "secondC",
      value: 0.2,
    };
    const parcelArea: Parameter = {
      ...p.parameters[0]!,
      id: "parcelArea",
      value: 150,
    };
    p.parameters.push(secondArea, secondC, parcelArea);
    p.parcel!.area = ref(parcelArea);
    p.zones.push({
      ...p.zones[0]!,
      id: "garden",
      name: "Taman",
      surface: "vegetation",
      area: ref(secondArea),
      coefficient: ref(secondC),
    });
    const result = calculateBaseline(p, "event");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rainfallM3).toBe(7.5);
      expect(result.value.runoffM3).toBe(4.5);
    }
    p.zones[0]!.surface = "soil";
    const swapped = calculateBaseline(p, "event");
    expect(swapped.ok && swapped.value.runoffM3).toBe(4.5);
  });
  it("is repeatable and stable under record ordering", () => {
    const p = fixture();
    expect(calculateBaseline(p, "event")).toEqual(
      calculateBaseline(structuredClone(p), "event"),
    );
    const key = baselineKey(p, "event");
    p.parameters.reverse();
    expect(baselineKey(p, "event")).toBe(key);
  });
});
describe("fail closed and stale results", () => {
  it.each(["area", "rain", "c"])(
    "blocks UNKNOWN %s even for zero rainfall",
    (id) => {
      const p = fixture(100, 0);
      const record = p.parameters.find((item) => item.id === id)!;
      record.value = null;
      record.evidence = "UNKNOWN";
      const result = calculateBaseline(p, "event");
      expect(result.ok).toBe(false);
      expect("value" in result).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    },
  );
  it("blocks missing parcel, missing zones, absent scenario, zero area, and numeric overflow", () => {
    for (const p of [
      { ...fixture(), parcel: null },
      { ...fixture(), zones: [] },
      fixture(0),
      fixture(Number.MAX_VALUE, Number.MAX_VALUE),
    ]) {
      const r = calculateBaseline(p, "event");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
    }
    expect(calculateBaseline(fixture(), "missing").ok).toBe(false);
  });
  it("blocks unconfirmed class and invalid numeric/provenance input", () => {
    const p = fixture();
    p.zones[0]!.surface = null;
    expect(calculateBaseline(p, "event").ok).toBe(false);
    for (const fields of [
      { value: -1 },
      { value: NaN },
      { value: Infinity },
      { unit: "mm" },
      { evidence: "MEASURED" },
      { source: "" },
    ]) {
      const q = fixture();
      Object.assign(q.parameters[2]!, fields);
      expect(calculateBaseline(q, "event").ok).toBe(false);
    }
  });
  it("stales results after numerical or evidence edits and scenario switching", () => {
    const p = fixture();
    const r = calculateBaseline(p, "event");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isBaselineStale(r.value, p, "event")).toBe(false);
    const sourceEdit = structuredClone(p);
    sourceEdit.parameters[0]!.source = "Sumber berbeda";
    expect(isBaselineStale(r.value, sourceEdit, "event")).toBe(true);
    p.parameters[1]!.value = 60;
    expect(isBaselineStale(r.value, p, "event")).toBe(true);
    expect(isBaselineStale(r.value, fixture(), "another-event")).toBe(true);
  });
});
