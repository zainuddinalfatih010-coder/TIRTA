import { describe, test, expect } from 'vitest';
import { journalEvidence } from './evidenceCatalog';
import { scientificClaims, authoritativeReferences, validateEvidenceRegistry, evidenceForClaim } from './evidenceRegistry';
describe('scientific evidence foundation', () => {
  test('25 distinct journal articles,20core+5reserve, separate authoritative references', () => {
    expect(validateEvidenceRegistry()).toEqual([]);
    expect(journalEvidence.filter(e => e.category === 'journal-core')).toHaveLength(20);
    expect(journalEvidence.filter(e => e.category === 'journal-reserve')).toHaveLength(5);
    expect(journalEvidence.some(e => e.geography.includes('Indonesia'))).toBe(true);
    expect(authoritativeReferences.find(e => e.id === 'STD-SNI-8456-2017')?.limitation).toContain('belum ditinjau');
  });
  test('all claims trace to nonempty valid evidence with visible limits', () => {
    for (const c of scientificClaims) {
      expect(evidenceForClaim(c.id)).toHaveLength(c.evidenceIds.length);
      expect(c.limitations.length).toBeGreaterThan(0);
      expect(c.uiLocations.length).toBeGreaterThan(0);
    }
    expect(evidenceForClaim('unsupported')).toEqual([]);
  });
});
