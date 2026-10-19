import { interventionEvidenceSchema } from './scientificContract';
import { z } from "zod";
import {
  idSchema,
  nameSchema,
  noteSchema,
  revisionSchema,
  referenceV2Schema as ref,
  pointSchema,
  polygonSchema,
  parameterV2Schema,
} from "./v2-primitives";
const applicability = { applicability: noteSchema, reviewedRainfallMm: z.number().finite().nonnegative().nullable().optional() };
export const siteAssessmentSchema = z.strictObject({
  connection: z.enum(["unknown", "yes", "no"]),
  infiltration: z.enum(["unknown", "yes", "no"]),
  plantingSpace: z.enum(["unknown", "yes", "no"]),
  surfaceChange: z.enum(["unknown", "yes", "no"]),
  source: noteSchema,
}).refine(v => [v.connection, v.infiltration, v.plantingSpace, v.surfaceChange].every(x => x === "unknown") || !!v.source.trim(), "Tuliskan dasar kondisi lokasi yang Anda nyatakan.");
const fields = {
  treatment: z.strictObject({ installationZoneId: idSchema.nullable(), sharedSourceMode: z.enum(['unresolved', 'ledger', 'alternative', 'parallel']), allocationNote: noteSchema, catchmentReviewed: z.boolean().nullable().optional() }).optional(),
  id: idSchema,
  name: nameSchema,
  revision: revisionSchema,
  enabled: z.boolean(),
  targets: z.array(idSchema).max(200),
  connectionNote: noteSchema,
  installationSiteId: idSchema.nullable(),
  occupiedArea: ref,
  totalCost: ref,
  applicability: noteSchema,
  planningNotes: noteSchema.optional(),
  siteAssessment: siteAssessmentSchema.optional(),
  excludes: z.array(idSchema).max(1000),
  placement: z
    .strictObject({
      point: pointSchema,
      footprint: polygonSchema.nullable(),
      context: z.literal("schematic"),
    })
    .nullable(),
};
const storagePerformance = z.strictObject({
  ...applicability,
  availableStorage: ref,
  reuse: z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("off") }),
    z.strictObject({ mode: z.literal("capture-then-reuse"), demand: ref }),
  ]),
});
const infiltrationPerformance = z.strictObject({
  ...applicability,
  infiltrationCapacity: ref,
});
const permeablePerformance = z.strictObject({
  ...applicability,
  additionalInfiltrationCapacity: ref,
});
// Each family keeps a distinct performance shape; empty maps/targets are recoverable drafts.
export const componentSchema = z.discriminatedUnion("family", [
  z.strictObject({
    ...fields,
    family: z.literal("storage"),
    waterUse: z.enum(["unknown", "irrigation", "cleaning", "toilet", "temporary"]).optional(),
    drawdown: z.enum(["unknown", "planned", "unavailable"]).optional(),
    performanceByScenario: z.record(idSchema, storagePerformance),
  }),
  z.strictObject({
    ...fields,
    family: z.literal("infiltration"),
    infiltrationType: z.enum(["well", "biopori"]).optional(),
    performanceByScenario: z.record(idSchema, infiltrationPerformance),
  }),
  z.strictObject({
    ...fields,
    family: z.literal("rain-garden"),
    plantingPlan: z.enum(["unknown", "adapted", "existing"]).optional(),
    performanceByScenario: z.record(idSchema, infiltrationPerformance),
  }),
  z.strictObject({
    ...fields,
    family: z.literal("permeable"),
    treatedArea: ref,
    performanceByScenario: z.record(idSchema, permeablePerformance),
  }),
]);
export type ComponentVariant = z.infer<typeof componentSchema>;
export const optionGroupSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  enabled: z.boolean(),
  choices: z
    .array(
      z.strictObject({
        id: idSchema,
        name: nameSchema,
        enabled: z.boolean(),
        componentIds: z.array(idSchema).max(1000),
      }),
    )
    .max(1000),
});
export const planSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  revision: revisionSchema,
  origin: z.enum(["manual", "optimizer"]),
  components: z.array(componentSchema).max(1000),
  parameters: z.array(parameterV2Schema).max(5000),
  scientificEvidence: z.record(idSchema, interventionEvidenceSchema).optional(),
  priority: z.array(idSchema).max(1000),
  optimizationScenarioId: idSchema.nullable(),
  comparisonScenarioIds: z.array(idSchema).max(30),
  originInputFingerprint: z.string().max(200000).nullable(),
  reviewedInputFingerprint: z.string().max(200000).nullable(),
  note: noteSchema,
});
