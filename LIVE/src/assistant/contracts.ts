import { z } from 'zod';

export const DAILY_ANALYSES = 5;
export const evidenceVersion = 'tirta-claims-2026-10-05';
export const quotaSchema = z.object({
  remaining: z.number().int().min(0).max(DAILY_ANALYSES),
  reserved: z.number().int().min(0).max(1),
  resetsAt: z.string().datetime(),
  scope: z.enum(['browser', 'account']),
  available: z.boolean(),
});
export type Quota = z.infer<typeof quotaSchema>;
export const candidateSchema = z.object({
  id: z.string().min(1).max(160), name: z.string().max(160),
  residual: z.number().finite().nonnegative(), cost: z.number().finite().nonnegative(),
  area: z.number().finite().nonnegative(), checks: z.array(z.string().max(600)).max(30),
});
export const analysisRequestSchema = z.object({
  requestId: z.string().uuid(), question: z.string().trim().min(1).max(1600),
  fingerprint: z.string().min(1).max(150), scenarioId: z.string().min(1).max(160),
  priority: z.enum(['residual', 'cost', 'area']),
  candidates: z.array(candidateSchema).max(12),
  baseline: z.number().finite().nonnegative().nullable(),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export const analysisResponseSchema = z.object({
  requestId: z.string().uuid(), fingerprint: z.string(), scenarioId: z.string(),
  explanation: z.string().trim().min(1).max(4000),
  sourceIds: z.array(z.string()).max(8), candidateId: z.string().nullable(), quota: quotaSchema,
});
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export function nextReset(now: number) {
  return new Date((Math.floor(now / 86400000) + 1) * 86400000).toISOString();
}
