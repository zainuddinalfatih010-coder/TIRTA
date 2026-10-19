import { unknownNumber, type InterventionEvidence } from './scientificContract';

/** Moving an installation does not move observations about its former ground. */
export function unreviewedReceivingSite(evidence: InterventionEvidence): InterventionEvidence {
  const next = structuredClone(evidence);
  next.performance = {};
  next.soilInfiltration = unknownNumber('mm/h');
  next.groundwaterDepth = unknownNumber('m');
  next.groundwaterAssessment = 'unknown'; next.groundwaterBasis = '';
  next.localStandardReview = 'unknown'; next.localStandardBasis = '';
  next.fieldVerified = null; next.verificationSource = '';
  next.condition = 'unknown'; next.maintenance = '';
  delete next.soilReference;
  return next;
}
