import { z } from "zod";

export const surfaceSchema = z.enum([
  "roof",
  "paved",
  "soil",
  "vegetation",
  "porous",
]);
export type Surface = z.infer<typeof surfaceSchema>;
export const surfaceLabels: Record<Surface, string> = {
  roof: "Atap",
  paved: "Beton/Aspal",
  soil: "Tanah terbuka",
  vegetation: "Vegetasi",
  porous: "Permukaan berpori",
};
export const interventionSchema = z.enum([
  "storage",
  "infiltration",
  "rain-garden",
  "permeable",
]);
export const unitSchema = z.enum(["mm", "m2", "m3/event", "ratio", "IDR"]);
export const evidenceSchema = z.enum([
  "MEASURED",
  "USER_INPUT",
  "SOURCE_DERIVED",
  "ASSIST_SUGGESTION",
  "ASSUMPTION",
  "DEMO",
  "UNKNOWN",
]);
export type Unit = z.infer<typeof unitSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
const identity = z.string().trim().min(1).max(120);
export const parameterSchema = z
  .strictObject({
    id: identity,
    value: z.number().finite().nonnegative().nullable(),
    unit: unitSchema,
    evidence: evidenceSchema,
    source: z.string().max(2000),
    note: z.string().max(2000),
  })
  .superRefine((p, ctx) => {
    if ((p.value === null) !== (p.evidence === "UNKNOWN"))
      ctx.addIssue({
        code: "custom",
        message: "Nilai belum diketahui harus berstatus UNKNOWN.",
      });
    if (p.unit === "ratio" && p.value !== null && p.value > 1)
      ctx.addIssue({
        code: "custom",
        message: "Koefisien harus antara 0 dan 1.",
      });
  });
export type Parameter = z.infer<typeof parameterSchema>;
export const referenceSchema = z.strictObject({
  id: identity,
  unit: unitSchema,
  evidence: evidenceSchema,
});
export type ParameterRef = z.infer<typeof referenceSchema>;
const pointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Point = z.infer<typeof pointSchema>;
export const zoneSchema = z.strictObject({
  id: identity,
  name: z.string().trim().min(1).max(100),
  surface: surfaceSchema.nullable(),
  polygon: z.array(pointSchema).min(3).max(100),
  area: referenceSchema,
  coefficient: referenceSchema,
});
export type Zone = z.infer<typeof zoneSchema>;
export const scenarioSchema = z.strictObject({
  id: identity,
  name: z.string().trim().min(1).max(100),
  rainfall: referenceSchema,
});
export type Scenario = z.infer<typeof scenarioSchema>;
export const projectSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: identity,
    name: z.string().trim().min(1).max(120),
    mode: z.enum(["real", "demo"]),
    parcel: z
      .strictObject({
        area: referenceSchema,
        polygon: z.array(pointSchema).min(3).max(100),
      })
      .nullable(),
    parameters: z.array(parameterSchema).max(5000),
    zones: z.array(zoneSchema).max(200),
    scenarios: z.array(scenarioSchema).max(30),
  })
  .superRefine((p, ctx) => {
    for (const [name, items] of [
      ["parameters", p.parameters],
      ["zones", p.zones],
      ["scenarios", p.scenarios],
    ] as const) {
      if (new Set(items.map((item) => item.id)).size !== items.length)
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "Identitas ganda tidak diperbolehkan.",
        });
    }
    if (
      p.mode === "real" &&
      p.parameters.some((item) => item.evidence === "DEMO")
    )
      ctx.addIssue({
        code: "custom",
        message: "Data simulasi tidak boleh dilabeli proyek riil.",
      });
  });
export type Project = z.infer<typeof projectSchema>;
export interface Issue {
  field?: string;
  componentId?: string;
  parameterId?: string;
  ruleId?: string;
  code: string;
  path: string;
  message: string;
}
export type Outcome<T> =
  { ok: true; value: T } | { ok: false; issues: Issue[] };

export function emptyProject(id: string, name: string): Project {
  return {
    schemaVersion: 1,
    id,
    name,
    mode: "real",
    parcel: null,
    zones: [],
    scenarios: [],
    parameters: [],
  };
}
export function ref(parameter: Parameter): ParameterRef {
  return {
    id: parameter.id,
    unit: parameter.unit,
    evidence: parameter.evidence,
  };
}
