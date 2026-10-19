import { describe, expect, it } from "vitest";
import { emptyProject, ref, surfaceSchema, interventionSchema } from "./model";
import type { Parameter, Project } from "./model";
import { numericInput, parseProject, resolveParameter } from "./validation";

const parameter: Parameter = {
  id: "p",
  value: 50,
  unit: "mm",
  evidence: "USER_INPUT",
  source: "Skenario pengguna",
  note: "",
};
const project = (): Project => ({
  ...emptyProject("test", "Uji"),
  parameters: [structuredClone(parameter)],
});

describe("input boundaries", () => {
  it("preserves UNKNOWN through file serialization and rejects unknown versions", () => {
    const p = project();
    p.parameters[0] = {
      ...parameter,
      value: null,
      evidence: "UNKNOWN",
      source: "",
    };
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual({
      ok: true,
      value: p,
    });
    expect(parseProject({ ...p, schemaVersion: 2 }).ok).toBe(false);
  });
  it.each(["", "  "])("keeps blank %j unknown rather than zero", (text) => {
    expect(numericInput(text)).toEqual({ ok: true, value: null });
  });
  it.each(["NaN", "Infinity", "-1", "3abc", "1e309"])(
    "rejects invalid numeric %j",
    (text) => {
      expect(numericInput(text).ok).toBe(false);
    },
  );
  it.each([
    ["0", 0],
    ["12.5", 12.5],
    ["12,5", 12.5],
  ] as const)("accepts explicit finite %s", (text, value) => {
    expect(numericInput(text)).toEqual({ ok: true, value });
  });
  it.each([NaN, Infinity, -1, "50"])(
    "rejects invalid persisted numeric %j",
    (value) => {
      expect(
        parseProject({ ...project(), parameters: [{ ...parameter, value }] })
          .ok,
      ).toBe(false);
    },
  );
  it("rejects null as known, numeric UNKNOWN, duplicate identities, and fake real demo", () => {
    for (const fields of [
      { value: null },
      { evidence: "UNKNOWN" },
      { value: 2, unit: "ratio" },
    ])
      expect(
        parseProject({
          ...project(),
          parameters: [{ ...parameter, ...fields }],
        }).ok,
      ).toBe(false);
    expect(
      parseProject({ ...project(), parameters: [parameter, parameter] }).ok,
    ).toBe(false);
    expect(
      parseProject({
        ...project(),
        parameters: [{ ...parameter, evidence: "DEMO" }],
      }).ok,
    ).toBe(false);
  });
  it("accepts exactly the five surfaces and four intervention families", () => {
    expect(surfaceSchema.options).toHaveLength(5);
    expect(interventionSchema.options).toHaveLength(4);
    expect(surfaceSchema.safeParse("water").success).toBe(false);
    expect(interventionSchema.safeParse("biopori").success).toBe(false);
  });
});

describe("provenance resolution", () => {
  it.each([
    "MEASURED",
    "USER_INPUT",
    "SOURCE_DERIVED",
    "ASSUMPTION",
    "DEMO",
  ] as const)("resolves explicit %s", (evidence) => {
    const p = project();
    const record = { ...parameter, evidence };
    p.parameters = [record];
    expect(resolveParameter(p, ref(record), "mm", "rainfall")).toEqual({
      ok: true,
      value: record,
    });
  });
  it("blocks unresolved, unit mismatch, evidence mismatch and absent source", () => {
    const p = project();
    for (const reference of [
      { ...ref(parameter), id: "missing" },
      { ...ref(parameter), unit: "m2" as const },
      { ...ref(parameter), evidence: "MEASURED" as const },
    ]) {
      const result = resolveParameter(p, reference, "mm", "rainfall");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    }
    p.parameters = [{ ...parameter, source: " " }];
    expect(resolveParameter(p, ref(parameter), "mm", "rainfall").ok).toBe(
      false,
    );
  });
  it.each(["UNKNOWN", "ASSIST_SUGGESTION"] as const)(
    "does not treat %s as numerical truth",
    (evidence) => {
      const record = {
        ...parameter,
        evidence,
        value: evidence === "UNKNOWN" ? null : 50,
      };
      expect(
        resolveParameter(
          { ...project(), parameters: [record] },
          ref(record),
          "mm",
          "rainfall",
        ).ok,
      ).toBe(false);
    },
  );
});
