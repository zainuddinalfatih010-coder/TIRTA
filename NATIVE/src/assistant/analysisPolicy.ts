import type { AnalysisRequest } from './contracts';

// This validates a declared priority; it does not introduce a weighted winner.
export function preferredCandidateIds(payload: AnalysisRequest): string[] {
  if (payload.baseline === null || payload.baseline === 0) return [];
  const valid = payload.candidates.filter(c => c.residual <= payload.baseline! + 1e-9);
  const minimum = Math.min(...valid.map(c => c[payload.priority]));
  return valid.filter(c => Math.abs(c[payload.priority] - minimum) <= 1e-9).map(c => c.id);
}
export function validExplanation(text: string): boolean {
  // All numeric results live in the deterministic UI, never free-form model prose.
  return !/[0-9]|https?:\/\/|www\./i.test(text)
    && !/menjamin|pasti aman|pasti bebas|bebas banjir sepenuhnya|terbukti memenuhi semua|tanpa perlu (?:pemeriksaan|pengujian)/i.test(text);
}
