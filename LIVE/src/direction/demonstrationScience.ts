import { scientificScenarioContext } from '../domain/scientificAuthoring';
import type { ProjectV2 } from '../domain/projectV2';
import { emptyScience, emptyInterventionEvidence, unknownNumber } from '../domain/scientificContract';
/** Explicit synthetic tutorial evidence. Never applied to a real or migrated project. */
export function declareDemonstrationScience(p: ProjectV2, uncertainty = false): ProjectV2 {
  if (p.mode !== 'demo') throw new Error('Bukti contoh hanya untuk proyek demo.');
  p.science = emptyScience();
  const source = 'DATA SINTETIS CONTOH — bukan hasil uji, survei atau kondisi sekolah nyata';
  for (const c of p.components) {
    const e = emptyInterventionEvidence();
    e.nominalTankCapacity = { value: 10, unit: 'm3', origin: 'user_supplied', source, method: '', date: '' };
    e.soilInfiltration = { value: 10, unit: 'mm/h', origin: 'user_supplied', source, method: '', date: '' };
    e.groundwaterAssessment = 'suitable'; e.groundwaterBasis = source;
    e.localStandardReview = 'reviewed'; e.localStandardBasis = `${source}; dalam contoh ini persyaratan dianggap telah ditinjau, bukan klaim memenuhi SNI`;
    e.system = 'Perkerasan berpori contoh'; e.specification = `${source}; sistem/lapisan dinyatakan sebagai asumsi contoh`;
    e.subgrade = 'suitable'; e.subgradeBasis = source;
    e.media = 'Media taman hujan contoh'; e.vegetation = 'Tanaman adaptif contoh';
    e.maintenance = 'Pemeriksaan dan pembersihan berkala dalam contoh';
    for (const [sid, perf] of Object.entries(c.performanceByScenario)) {
      const ref = 'availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity;
      const parameter = p.parameters.find(x => x.id === ref.id)!;
      e.performance[sid] = { origin: 'user-entered', source, subgradeDependent: c.family === 'permeable' ? true : null, parameterId: parameter.id, parameterRevision: parameter.revision, ...scientificScenarioContext(p, sid) };
    }
    for (const zoneId of c.targets) p.science.connections.push({ id: `demo-${c.id}-${zoneId}`, candidateId: c.id, sourceZoneId: zoneId, destination: { kind: 'intervention', id: c.id }, via: 'other', origin: 'user_supplied', source });
    if (uncertainty && c.family === 'storage') {
      for (const basis of Object.values(e.performance)) basis.origin = 'design-declared';
      e.fieldVerified = true; e.verificationSource = source;
      e.overflow = { kind: 'drainage', note: source }; c.waterUse = 'irrigation'; c.drawdown = 'planned';
    }
    if (uncertainty && c.family === 'infiltration') {
      e.soilInfiltration = unknownNumber('mm/h'); e.groundwaterAssessment = 'unknown'; e.groundwaterBasis = '';
    }
    p.science.interventions[c.id] = e;
  }
  return p;
}
