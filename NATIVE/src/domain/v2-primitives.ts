import { z } from "zod";
import { evidenceSchema, surfaceSchema } from "./model";
export const idSchema = z.string().trim().min(1).max(120);
export const nameSchema = z.string().trim().min(1).max(120);
export const noteSchema = z.string().max(2000);
export const revisionSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const unitV2Schema = z.enum([
  "mm",
  "m",
  "m2",
  "m3/event",
  "ratio",
  "IDR",
]);
export const pointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
export const polygonSchema = z.array(pointSchema).min(3).max(100);
export const referenceV2Schema = z.strictObject({
  id: idSchema,
  unit: unitV2Schema,
  evidence: evidenceSchema,
});
export type ReferenceV2 = z.infer<typeof referenceV2Schema>;
export const parameterV2Schema = z
  .strictObject({
    id: idSchema,
    revision: revisionSchema,
    value: z.number().finite().nonnegative().nullable(),
    unit: unitV2Schema,
    evidence: evidenceSchema,
    source: noteSchema,
    note: noteSchema,
    applicability: noteSchema,
  })
  .superRefine((p, ctx) => {
    if ((p.value === null) !== (p.evidence === "UNKNOWN"))
      ctx.addIssue({
        code: "custom",
        message: "UNKNOWN harus memiliki nilai null.",
      });
    if (p.unit === "ratio" && p.value !== null && p.value > 1)
      ctx.addIssue({ code: "custom", message: "Koefisien harus 0–1." });
  });
export type ParameterV2 = z.infer<typeof parameterV2Schema>;
export const areaMethodSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("direct") }),
  z.strictObject({
    kind: z.literal("measured-rectangle"),
    length: referenceV2Schema,
    width: referenceV2Schema,
  }),
]);
export const areaFields = {
  area: referenceV2Schema,
  areaMethod: areaMethodSchema,
};
export const predictionSchema = z
  .strictObject({
    evidenceClass: z.literal("ASSIST_SUGGESTION"),
    predictedClass: surfaceSchema,
    probabilities: z.tuple([
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
    confidence: z.number(),
    modelId: idSchema,
    modelVersion: idSchema,
    modelSha256: z.string().regex(/^[a-f0-9]{64}$/),
    preprocessingVersion: idSchema,
    calibrationVersion: idSchema.nullable(),
    thresholdPolicyVersion: idSchema,
  })
  .superRefine((p, ctx) => {
    const v = p.probabilities,
      max = Math.max(...v),
      labels = surfaceSchema.options;
    if (
      v.some((x) => !Number.isFinite(x) || x < 0 || x > 1) ||
      Math.abs(v.reduce((a, b) => a + b, 0) - 1) > 1e-6 ||
      p.confidence !== max ||
      p.predictedClass !== labels[v.indexOf(max)]
    )
      ctx.addIssue({
        code: "custom",
        message: "BAD_OUTPUT: probabilitas atau pemetaan kelas tidak valid.",
      });
  });
export type Prediction = z.infer<typeof predictionSchema>;
export const classificationSchema = z.union([
  z
    .strictObject({
      id: idSchema,
      zoneId: idSchema,
      revision: revisionSchema,
      predecessorId: idSchema.nullable(),
      origin: z.enum(["manual", "surface-assist"]),
      evidenceClass: z.literal("USER_INPUT"),
      state: z.enum(["confirmed", "corrected"]),
      confirmedClass: surfaceSchema,
      correctedClass: surfaceSchema.nullable(),
      prediction: predictionSchema.nullable(),
      note: noteSchema,
    })
    .superRefine((r, ctx) => {
      const corrected =
        r.prediction !== null &&
        r.prediction.predictedClass !== r.confirmedClass;
      if (
        (r.origin === "manual") !== (r.prediction === null) ||
        r.state !== (corrected ? "corrected" : "confirmed") ||
        r.correctedClass !== (corrected ? r.confirmedClass : null)
      )
        ctx.addIssue({
          code: "custom",
          message: "Riwayat konfirmasi tidak konsisten.",
        });
    }),
  z.strictObject({
    id: idSchema,
    zoneId: idSchema,
    revision: revisionSchema,
    origin: z.literal("demo"),
    evidenceClass: z.literal("DEMO"),
    state: z.literal("fixture"),
    class: surfaceSchema,
    source: noteSchema,
  }),
]);
