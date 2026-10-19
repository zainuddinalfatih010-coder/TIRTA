import { z } from 'zod';
const text = z.string().max(2000);
const key = z.string().min(1).max(120);
export const scientificOrigin = z.enum(['measured', 'user_supplied', 'literature_guidance', 'derived', 'legacy_fixture', 'unknown']);
export const performanceOrigin = z.enum(['measured', 'design-declared', 'literature-guided', 'user-entered', 'unknown']);
export const scientificNumberSchema = z.strictObject({
  value: z.number().finite().nonnegative().nullable(),
  unit: z.enum(['minutes', 'mm', 'mm/h', 'm', 'm3', 'degrees']),
  origin: scientificOrigin, source: text, method: text, date: z.union([z.iso.date(), z.literal('')]),
}).superRefine((v, ctx) => {
  if ((v.value === null) !== (v.origin === 'unknown')) ctx.addIssue({ code: 'custom', message: 'Angka UNKNOWN harus null; nol harus dinyatakan dengan sumber.' });
  if (v.value !== null && !v.source.trim()) ctx.addIssue({ code: 'custom', message: 'Angka yang diketahui memerlukan dasar/sumber.' });
  if (v.origin === 'measured' && (!v.method.trim() || !v.date)) ctx.addIssue({ code: 'custom', message: 'Pengukuran memerlukan metode dan tanggal.' });
});
const numberWithUnit = (unit: z.infer<typeof scientificNumberSchema>['unit']) => scientificNumberSchema.refine(v => v.unit === unit, `Gunakan satuan ${unit}.`);
export type ScientificNumber = z.infer<typeof scientificNumberSchema>;
export const destinationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('zone'), id: key }),
  z.strictObject({ kind: z.literal('intervention'), id: key }),
  z.strictObject({ kind: z.literal('drainage'), note: text }),
  z.strictObject({ kind: z.literal('outside'), note: text }),
  z.strictObject({ kind: z.literal('unknown') }),
]);
export type Destination = z.infer<typeof destinationSchema>;
const soilSchema = z.strictObject({
  description: z.enum(['sandy', 'loamy', 'clayey', 'mixed', 'unknown']),
  compaction: z.enum(['loose', 'moderate', 'compacted', 'unknown']),
  infiltration: numberWithUnit('mm/h'),
});
/** A user's qualitative observation is not a measurement or a hydraulic input. */
export const fieldObservationSchema = z.strictObject({
  condition: z.enum(['unknown', 'ponding', 'concentrated-runoff', 'no-known-issue']),
  note: z.string().trim().max(500),
});
export type FieldObservation = z.infer<typeof fieldObservationSchema>;
const roofPoint = z.strictObject({x:z.number().finite(),y:z.number().finite()});
export const roofRoutingSchema=z.strictObject({ridges:z.array(z.tuple([roofPoint,roofPoint])).max(8),fall:z.array(z.strictObject({from:roofPoint,to:roofPoint})).max(8),outletPoint:roofPoint.nullable(),outletEdge:z.number().int().nonnegative().nullable(),destinationZoneId:key.nullable(),polygonFingerprint:text,status:z.enum(['confirmed','unchecked'])});
export const surfaceContextSchema = z.strictObject({
  source: text,
  fieldObservation: fieldObservationSchema.optional(),
  roof: z.strictObject({ form: z.enum(['flat', 'sloped', 'single-slope', 'gable', 'mixed', 'unknown']), material: text, outlet: z.enum(['gutter-downpipe', 'edge', 'drain', 'mixed', 'unknown']), pitch: numberWithUnit('degrees').refine(v => v.value === null || v.value < 90, 'Kemiringan atap harus 0 hingga kurang dari 90 derajat.').optional(), routing:roofRoutingSchema.optional() }),
  paved: z.strictObject({ material: text, condition: text, cracks: text }),
  soil: soilSchema,
  vegetation: z.enum(['grass', 'shrub', 'tree', 'mixed', 'unknown']),
  porous: z.strictObject({ system: text, surfaceLayer: text, base: text, subgrade: text, installationDate: z.union([z.iso.date(), z.literal('')]), maintenance: text, clogging: z.enum(['unknown', 'observed', 'not-observed']) }),
});
export type SurfaceContext = z.infer<typeof surfaceContextSchema>;
export const interventionEvidenceSchema = z.strictObject({
  soilReference: z.strictObject({ zoneId: key, confirmation: z.string().trim().min(1).max(2000), observation: numberWithUnit('mm/h') }).optional(),
  biopori: z.strictObject({ count: z.number().int().positive().nullable(), diameterCm: z.number().finite().positive().nullable(), depthCm: z.number().finite().positive().nullable(), source: text }).refine(v => [v.count, v.diameterCm, v.depthCm].every(x => x === null) || !!v.source.trim(), 'Rencana fisik yang diketahui memerlukan dasar.').optional(),
  performance: z.record(key, z.strictObject({ origin: performanceOrigin, source: text, subgradeDependent: z.boolean().nullable(), parameterId: key, parameterRevision: z.number().int().positive(), rainfallMm: z.number().finite().nonnegative().nullable().optional(), durationMinutes: z.number().finite().positive().nullable().optional(), method: text.optional(), date: z.union([z.iso.date(), z.literal('')]).optional() })),
  nominalTankCapacity: numberWithUnit('m3'),
  soilInfiltration: numberWithUnit('mm/h'),
  groundwaterDepth: numberWithUnit('m'),
  groundwaterAssessment: z.enum(['unknown', 'suitable', 'unsuitable', 'not-applicable']),
  groundwaterBasis: text,
  system: text, specification: text, media: text, vegetation: text,
  subgrade: z.enum(['unknown', 'suitable', 'unsuitable']), subgradeBasis: text,
  localStandardReview: z.enum(['unknown', 'reviewed', 'failed']), localStandardBasis: text,
  overflow: destinationSchema,
  fieldVerified: z.boolean().nullable(), verificationSource: text,
  maintenance: text, condition: z.enum(['unknown', 'maintained', 'clogged', 'damaged']),
});
export type InterventionEvidence = z.infer<typeof interventionEvidenceSchema>;
export const connectionSchema = z.strictObject({
  id: key, sourceZoneId: key, destination: destinationSchema, candidateId: key.optional(),
  via: z.enum(['gutter-downpipe', 'edge', 'drain', 'other', 'unknown']),
  origin: scientificOrigin, source: text,
}).superRefine((v, ctx) => {
  if (v.destination.kind !== 'unknown' && (v.origin === 'unknown' || !v.source.trim())) ctx.addIssue({ code: 'custom', message: 'Hubungan yang dinyatakan memerlukan dasar; jarak gambar tidak membuktikan sambungan.' });
});
export type Connection = z.infer<typeof connectionSchema>;
const fieldEventSchema = z.strictObject({
  date: z.union([z.iso.date(), z.literal('')]), rain: numberWithUnit('mm'), duration: numberWithUnit('minutes').refine(v => v.value === null || v.value > 0, 'Durasi kejadian harus positif.'),
  ponding: z.enum(['unknown', 'observed', 'not-observed']), locations: text,
  pondingDuration: numberWithUnit('minutes'), note: text,
  photo: z.string().max(3 * 1024 * 1024).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Gunakan foto raster yang didukung, bukan HTML/SVG.'),
});
export const fieldEvaluationSchema = z.strictObject({
  id: key, planId: key, planRevision: z.number().int().positive(),
  before: fieldEventSchema, after: fieldEventSchema,
  comparable: z.boolean().nullable(), comparisonBasis: text,
  installedAsPlanned: z.boolean().nullable(), installationNote: text,
  maintenance: text, condition: z.enum(['unknown', 'maintained', 'clogged', 'damaged']),
});
export type FieldEvaluation = z.infer<typeof fieldEvaluationSchema>;
export const scientificRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  surfaces: z.record(key, surfaceContextSchema),
  rainfall: z.record(key, numberWithUnit('minutes').refine(v => v.value === null || v.value > 0, 'Durasi hujan harus positif.')),
  connections: z.array(connectionSchema).max(2000),
  interventions: z.record(key, interventionEvidenceSchema),
  legacyNeedsVerification: z.array(key).max(1000),
  observations: z.array(fieldEvaluationSchema).max(20),
});
export type ScientificRevision = z.infer<typeof scientificRevisionSchema>;
export const unknownNumber = (unit: ScientificNumber['unit']): ScientificNumber => ({ value: null, unit, origin: 'unknown', source: '', method: '', date: '' });
export function emptyScience(): ScientificRevision {
  return { schemaVersion: 1, surfaces: {}, rainfall: {}, connections: [], interventions: {}, legacyNeedsVerification: [], observations: [] };
}
export function emptySurfaceContext(): SurfaceContext {
  return { source: '', roof: { form: 'unknown', material: '', outlet: 'unknown', pitch: unknownNumber('degrees') }, paved: { material: '', condition: '', cracks: '' }, soil: { description: 'unknown', compaction: 'unknown', infiltration: unknownNumber('mm/h') }, vegetation: 'unknown', porous: { system: '', surfaceLayer: '', base: '', subgrade: '', installationDate: '', maintenance: '', clogging: 'unknown' } };
}
export function emptyInterventionEvidence(): InterventionEvidence {
  return { performance: {}, nominalTankCapacity: unknownNumber('m3'), soilInfiltration: unknownNumber('mm/h'), groundwaterDepth: unknownNumber('m'), groundwaterAssessment: 'unknown', groundwaterBasis: '', system: '', specification: '', media: '', vegetation: '', subgrade: 'unknown', subgradeBasis: '', localStandardReview: 'unknown', localStandardBasis: '', overflow: { kind: 'unknown' }, fieldVerified: null, verificationSource: '', maintenance: '', condition: 'unknown' };
}
