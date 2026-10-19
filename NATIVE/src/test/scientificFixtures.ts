import { scientificScenarioContext } from '../domain/scientificAuthoring';
import type { ProjectV2 } from '../domain/projectV2';
import { emptyScience, emptyInterventionEvidence } from '../domain/scientificContract';
/** Deliberate laboratory fixture declarations, never imported by production code. */
export function qualifyScientificFixture(p: ProjectV2): ProjectV2 {
  p.science ??= emptyScience();
  const source = 'Explicit arithmetic test assumption, not a surveyed site';
  for (const c of p.components) {
    const e = emptyInterventionEvidence();
    e.nominalTankCapacity = { value: 100, unit: 'm3', origin: 'user_supplied', source, method: '', date: '' };
    e.soilInfiltration = { value: 10, unit: 'mm/h', origin: 'user_supplied', source, method: '', date: '' };
    e.groundwaterAssessment = 'suitable'; e.groundwaterBasis = source;
    e.localStandardReview = 'reviewed'; e.localStandardBasis = source;
    e.system = 'Explicit test system'; e.specification = source; e.subgrade = 'suitable'; e.subgradeBasis = source; e.media = source; e.vegetation = source;
    for (const [sid, perf] of Object.entries(c.performanceByScenario)) {
      const baseRef = 'availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity;
      const ref = p.scenarios.find(s => s.id === sid)?.overrides.find(o => o.baseParameterId === baseRef.id)?.replacement ?? baseRef;
      const parameter = p.parameters.find(x => x.id === ref.id)!;
      e.performance[sid] = { origin: 'user-entered', source, subgradeDependent: c.family === 'permeable' ? true : null, parameterId: parameter.id, parameterRevision: parameter.revision, ...scientificScenarioContext(p, sid) };
    }
    p.science.interventions[c.id] = e;
    p.science.connections = p.science.connections.filter(link => link.candidateId !== c.id);
    for (const z of p.zones) p.science.connections.push({ id: `test-${c.id}-${z.id}`, candidateId: c.id, sourceZoneId: z.id, destination: { kind: 'intervention', id: c.id }, via: 'other', origin: 'user_supplied', source });
  }
  return p;
}
