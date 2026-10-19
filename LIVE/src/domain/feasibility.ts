import type { ProjectV2 } from './projectV2';
import type { ComponentVariant } from './intervention-contract';
import type { InterventionEvidence } from './scientificContract';
import type { ParameterV2 } from './v2-primitives';
import { sourceConnects, routingIssues, type RoutingContext } from './sourceRouting';
import { scientificClaims } from './evidenceRegistry';
import { bioporiInstallationAllowed, referencedSoil, sharedSources } from './treatmentDesign';
import { legacySiteFindings } from './interventionSuitability';

export const feasibilityStatuses = ['FEASIBLE_PRELIMINARY', 'FEASIBLE_WITH_CONDITIONS', 'MORE_DATA_REQUIRED', 'INFEASIBLE_WITH_AVAILABLE_DATA'] as const;
export type FeasibilityStatus = typeof feasibilityStatuses[number];
export const feasibilityLabels: Record<FeasibilityStatus, string> = {
  FEASIBLE_PRELIMINARY: 'Layak untuk pra-perencanaan', FEASIBLE_WITH_CONDITIONS: 'Layak dengan syarat',
  MORE_DATA_REQUIRED: 'Perlu data tambahan', INFEASIBLE_WITH_AVAILABLE_DATA: 'Tidak sesuai dengan data tersedia',
};
export type ScreeningFinding = { ruleId: string; field?: string; claimId: string; evidenceIds: string[]; message: string };
export type Feasibility = { status: FeasibilityStatus; reasons: ScreeningFinding[]; missing: ScreeningFinding[]; conditions: ScreeningFinding[]; fieldChecks: string[] };
export const screeningRules = [
  ['CONNECTION', 'CLAIM-CONNECTION'], ['CAPACITY', 'CLAIM-STORAGE'], ['PERFORMANCE', 'CLAIM-LOCAL'],
  ['BIOPORI_SITE', 'CLAIM-BIOPORI'], ['SOIL', 'CLAIM-SOIL'], ['GROUNDWATER', 'CLAIM-GROUNDWATER'], ['STANDARD', 'CLAIM-GROUNDWATER'],
  ['MEDIA', 'CLAIM-BIO-MEDIA'], ['CONVERSION', 'CLAIM-POROUS'], ['SUBGRADE', 'CLAIM-POROUS'],
  ['MAINTENANCE', 'CLAIM-MAINTENANCE'], ['FIELD', 'CLAIM-FIELD'], ['LIMIT', 'CLAIM-VOLUME-LIMIT'], ['RESOURCE', 'CLAIM-LOCAL'],
] as const;
/** Screening only. It neither derives a capacity from soil nor certifies a construction. */
export function assessIntervention(p: ProjectV2, c: ComponentVariant, sid: string, parameters: ParameterV2[] = p.parameters, frozenEvidence?: InterventionEvidence, includeResources = true, selectedComponents?: ComponentVariant[]): Feasibility {
  const result: Feasibility = { status: 'MORE_DATA_REQUIRED', reasons: [], missing: [], conditions: [], fieldChecks: [] };
  const finding = (ruleId: typeof screeningRules[number][0], message: string, field?: string): ScreeningFinding => {
    const claimId = screeningRules.find(r => r[0] === ruleId)![1];
    return { ruleId, field, claimId, evidenceIds: scientificClaims.find(x => x.id === claimId)!.evidenceIds, message };
  };
  const missing = (rule: typeof screeningRules[number][0], message: string, field?: string) => result.missing.push(finding(rule, message, field));
  const reject = (rule: typeof screeningRules[number][0], message: string, field?: string) => result.reasons.push(finding(rule, message, field));
  const condition = (rule: typeof screeningRules[number][0], message: string, field?: string) => result.conditions.push(finding(rule, message, field));
  if (sharedSources(selectedComponents ? { ...p, components: selectedComponents } : p, c).some(other => !c.excludes.includes(other.id) && !other.excludes.includes(c.id)) && c.treatment) {
    if (c.treatment.sharedSourceMode === 'unresolved') missing('CONNECTION', 'Sumber dipakai beberapa penanganan. Nyatakan alternatif atau pembagian sisa dalam neraca.', 'sharedSourceMode');
    if (c.treatment.sharedSourceMode === 'parallel') reject('CONNECTION', 'Pembagian aliran paralel belum dapat dihitung; tidak ada fraksi aliran yang diasumsikan.', 'sharedSourceMode');
  }
  if (c.family === 'infiltration' && c.infiltrationType === 'biopori') {
    const zone = p.zones.find(z => z.id === c.treatment?.installationZoneId);
    if (!zone) missing('BIOPORI_SITE', 'Pilih lokasi pemasangan Biopori. Semua jenis permukaan dapat dipilih kecuali Atap; sumber limpasan boleh berasal dari zona lain.');
    else if (!bioporiInstallationAllowed(zone.surface)) reject('BIOPORI_SITE', 'Biopori tidak dapat dipasang pada Atap. Pilih Beton/Aspal, Tanah terbuka, Vegetasi, atau Permukaan berpori.');
  }
  const known = (items: ParameterV2[], id: string | undefined, unit: ParameterV2['unit']) => {
    const v = items.find(x => x.id === id);
    return v && v.unit === unit && v.value !== null && Number.isFinite(v.value) && v.value >= 0 && v.evidence !== 'UNKNOWN' && v.evidence !== 'ASSIST_SUGGESTION' && v.source.trim() ? v.value : null;
  };
  const cost = known(parameters, c.totalCost.id, 'IDR'), area = known(parameters, c.occupiedArea.id, 'm2');
  const budget = known(p.parameters, p.constraints.budget.id, 'IDR'), land = known(p.parameters, p.constraints.usableArea.id, 'm2');
  const site = p.installationSites.find(s => s.id === c.installationSiteId);
  const siteArea = known(p.parameters, site?.availableArea.id, 'm2');
  if (includeResources && (cost === null || area === null || budget === null || land === null || (site && siteArea === null)))
    missing('RESOURCE', 'Biaya, ruang terpakai, batas anggaran/lahan dan dasar ruang pemasangan perlu diketahui.');
  if (includeResources && cost !== null && budget !== null && cost > budget) reject('RESOURCE', 'Biaya opsi ini melebihi batas anggaran.', 'budget');
  if (includeResources && area !== null && ((land !== null && area > land) || (siteArea !== null && area > siteArea))) reject('RESOURCE', 'Ruang opsi ini melebihi lahan yang dinyatakan tersedia.', 'area');
  const receivingZone = p.zones.find(z => z.id === c.treatment?.installationZoneId);
  if (receivingZone) {
    const receivingArea = known(p.parameters, receivingZone.area.id, 'm2');
    const occupants = (selectedComponents ?? [c]).filter(other => other.enabled && other.treatment?.installationZoneId === receivingZone.id);
    const footprints = occupants.map(other => known(parameters, other.occupiedArea.id, 'm2'));
    if (includeResources && receivingArea === null) missing('RESOURCE', `${receivingZone.name}: luas lokasi pemasangan belum diketahui.`);
    if (includeResources && receivingArea !== null && footprints.every(value => value !== null) && footprints.reduce((sum, value) => sum + value, 0) > receivingArea)
      reject('RESOURCE', `${receivingZone.name}: jumlah ruang pemasangan melebihi luas zona. Kurangi luas penanganan atau pilih lokasi lain.`, 'area');
  }
  const evidence = p.science?.interventions[c.id];
  const perf = c.performanceByScenario[sid];
  const ref = perf && ('availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
  const effectiveRef = ref && (p.scenarios.find(s => s.id === sid)?.overrides.find(o => o.baseParameterId === ref.id)?.replacement ?? ref);
  const parameter = effectiveRef && (effectiveRef !== ref ? p.parameters : parameters).find(x => x.id === effectiveRef.id);
  // Field documentation cannot change which declared capacity review belongs to a frozen plan.
  const basis = frozenEvidence?.performance[sid] ?? evidence?.performance[sid];
  if (!parameter || parameter.value === null || parameter.evidence === 'UNKNOWN') missing('PERFORMANCE', 'Kapasitas per kejadian belum diketahui.', 'capacity');
  if (parameter && (parameter.unit !== 'm3/event' || parameter.evidence !== effectiveRef?.evidence || !parameter.source.trim() || parameter.evidence === 'ASSIST_SUGGESTION'))
    missing('PERFORMANCE', 'Satuan atau provenance kapasitas tidak sesuai.', 'capacitySource');
  if (!basis || basis.origin === 'unknown')
    condition('PERFORMANCE', 'Verifikasi penerapan kapasitas yang dinyatakan sebelum desain.', 'capacityBasis');
  else if (!basis.source.trim() || basis.parameterId !== parameter?.id || basis.parameterRevision !== parameter?.revision)
    missing('PERFORMANCE', 'Tinjau dasar kapasitas untuk angka dan skenario yang sedang dipakai.', 'capacityBasis');
  else if (basis.origin === 'measured' && (!basis.method?.trim() || !basis.date)) missing('PERFORMANCE', 'Kinerja terukur memerlukan metode dan tanggal pengukuran.', 'performanceMethod');
  else if (basis.origin === 'literature-guided' || basis.origin === 'user-entered') condition('PERFORMANCE', 'Kapasitas masih berbasis deklarasi/asumsi; verifikasi penerapannya di lokasi.');
  const scenario = p.scenarios.find(s => s.id === sid);
  const rainRef = scenario && (scenario.overrides.find(o => o.baseParameterId === scenario.rainfall.id)?.replacement ?? scenario.rainfall);
  const rainfall = p.parameters.find(x => x.id === rainRef?.id)?.value ?? null;
  const duration = p.science?.rainfall[sid]?.value ?? null;
  if (c.family !== 'storage' && basis && basis.origin !== 'unknown' && (basis.rainfallMm !== rainfall || basis.durationMinutes !== duration))
    missing('PERFORMANCE', 'Konteks hujan/durasi berubah atau belum ditinjau untuk kapasitas ini.', 'performanceContext');
  const routingContext: RoutingContext = {
    componentIds: (selectedComponents ?? [c]).map(component => component.id),
    // An explicitly supplied frozen definition can retain its declared historical recipients.
    // Merely copying current evidence into a snapshot does not bypass current lifecycle checks.
    allowHistoricalDestinations: !!frozenEvidence && !p.components.some(current => current.id === c.id && current.enabled),
  };
  const graphIssues = routingIssues(p, routingContext);
  if (graphIssues.length) reject('CONNECTION', graphIssues.join(' '), 'connection');
  if (!c.targets.length) missing('CONNECTION', c.family === 'permeable' ? 'Pilih satu zona Beton/Aspal yang akan diubah.' : 'Pilih sumber air yang akan ditangani.', 'source');
  if (new Set(c.targets).size !== c.targets.length || c.targets.some(id => !p.zones.some(z => z.id === id))) reject('CONNECTION', c.family === 'permeable' ? 'Zona konversi tidak tersedia atau dinyatakan ganda.' : 'Zona sumber tidak tersedia atau dinyatakan ganda.', 'source');
  if (c.family !== 'permeable' && c.targets.some(id => !sourceConnects(p, id, c.id, routingContext)))
    condition('CONNECTION', 'Periksa penyaluran fisik dari sumber yang dimodelkan ke penanganan.', 'via');
  for (const legacy of legacySiteFindings(c)) reject(legacy.rule,legacy.message,legacy.field);
  if (c.family === 'storage') {
    const nominal = evidence?.nominalTankCapacity;
    if (nominal?.value !== null && nominal?.value !== undefined && (nominal.unit !== 'm3' || !Number.isFinite(nominal.value) || nominal.value < 0 || nominal.origin === 'unknown' || !nominal.source.trim()))
      missing('CAPACITY', 'Periksa satuan dan dasar kapasitas nominal yang diisi.', 'nominal');
    else if (nominal?.value !== null && nominal?.value !== undefined && parameter?.value !== null && parameter?.value !== undefined && parameter.value > nominal.value)
      reject('CAPACITY', 'Ruang kosong tersedia melebihi kapasitas nominal tangki.', 'nominal');
    if (!c.waterUse || c.waterUse === 'unknown' || !c.drawdown || c.drawdown === 'unknown') condition('CAPACITY', 'Tentukan penggunaan air dan pengosongan sebelum kejadian berikutnya.');
  } else {
    const porous = c.family === 'permeable';
    const needsSoil = !porous || basis?.subgradeDependent === true;
    if (porous) {
      const zone = p.zones.find(z => z.id === c.targets[0]);
      if (c.targets.length !== 1 || !zone || zone.surface !== 'paved') reject('CONVERSION', 'Konversi perkerasan hanya untuk satu zona Beton/Aspal. Atap hijau memakai mekanisme lain; permukaan yang sudah berpori tetap dihitung di baseline.');
      const converted = known(parameters, c.treatedArea.id, 'm2'), targetArea = known(p.parameters, zone?.area.id, 'm2');
      if (converted === null || targetArea === null) missing('CONVERSION', 'Luas konversi dan luas target perlu diketahui.');
      else if (converted <= 0 || converted > targetArea || converted !== area) reject('CONVERSION', 'Luas konversi harus positif, tidak melebihi zona dan sama dengan ruang perlakuan yang dinyatakan.');
      if (!evidence?.system.trim() || !evidence.specification.trim()) condition('CONVERSION', 'Nyatakan sistem dan spesifikasi konversi berpori sebelum penerapan.');
      if (basis?.subgradeDependent === null || basis?.subgradeDependent === undefined) condition('SUBGRADE', 'Periksa ketergantungan kinerja pada tanah dasar.');
      if (basis?.subgradeDependent === true && (!evidence || evidence.subgrade === 'unknown' || !evidence.subgradeBasis.trim())) condition('SUBGRADE', 'Kesesuaian tanah dasar dan bukti pendukung belum diketahui.');
      if (evidence?.subgrade === 'unsuitable') reject('SUBGRADE', 'Tanah dasar dinyatakan tidak sesuai untuk sistem ini.');
    }
    if (needsSoil) {
      const soil = evidence ? referencedSoil(p, c, evidence) : null;
      const currentSoil=evidence?.soilReference && evidence.soilReference.zoneId===c.treatment?.installationZoneId ? p.science?.surfaces[evidence.soilReference.zoneId]?.soil.infiltration : null;
      if (soil?.stale && currentSoil?.value===0 && currentSoil.origin!=='unknown' && currentSoil.source.trim()) reject('SOIL','Bukti lokasi terbaru menyatakan infiltrasi nol; tinjau kapasitas atau lokasi.', 'soil');
      else if (soil?.stale) condition('SOIL', 'Rujukan tanah berubah atau lokasi penerapan berbeda. Konfirmasi ulang bukti lokasi.', 'soil');
      else if (soil?.number?.unit !== 'mm/h' || soil.number.value === null) condition('SOIL', 'Bukti infiltrasi tanah belum tersedia; verifikasi di lokasi sebelum penerapan.', 'soil');
      else if (soil.number.value === 0) reject('SOIL', 'Bukti menyatakan infiltrasi nol; tidak ada dasar untuk kredit resapan.');
      else if (soil.number.origin !== 'measured') condition('SOIL', 'Bukti tanah belum merupakan pengukuran lapangan; perlu uji lokasi.');
      if (!evidence || evidence.groundwaterAssessment === 'unknown' || !evidence.groundwaterBasis.trim()) condition('GROUNDWATER', 'Tinjauan air tanah setempat dan dasarnya belum diketahui.', 'groundwater');
      if (evidence?.groundwaterAssessment === 'unsuitable') reject('GROUNDWATER', 'Kondisi air tanah dinyatakan tidak sesuai.');
      if (!evidence || evidence.localStandardReview === 'unknown' || !evidence.localStandardBasis.trim()) condition('STANDARD', 'Periksa persyaratan setempat sebelum penerapan; TIRTA tidak menetapkan ambang standar otomatis.');
      if (evidence?.localStandardReview === 'failed') reject('STANDARD', 'Tinjauan persyaratan setempat menyatakan tidak memenuhi.');
    }
    if (c.family === 'rain-garden' && (!evidence?.media.trim() || !evidence.vegetation.trim())) condition('MEDIA', 'Rencanakan media dan tanaman sebelum penerapan; angka ini hanya memakai kapasitas kejadian yang telah dinyatakan.');
  }
  if (evidence?.overflow.kind === 'unknown' || !evidence) condition('CONNECTION', 'Tujuan luapan masih UNKNOWN; tentukan sebelum desain lanjutan.');
  if (evidence?.condition === 'clogged' || evidence?.condition === 'damaged') reject('MAINTENANCE', 'Instalasi tersumbat/rusak; kinerja lama tidak boleh langsung digunakan.');
  if (!evidence?.maintenance.trim()) condition('MAINTENANCE', 'Nyatakan pemeriksaan dan pemeliharaan instalasi.');
  if (evidence?.fieldVerified !== true || !evidence.verificationSource.trim()) condition('FIELD', 'Pemeriksaan lokasi belum lengkap. Ini penyaringan pra-perencanaan, bukan jaminan pelaksanaan.');
  result.fieldChecks = ['Periksa sambungan dan tujuan luapan di lokasi.', 'Verifikasi angka kapasitas, biaya, ruang dan pemeliharaan sebelum desain.'];
  if (c.family !== 'storage') result.fieldChecks.push('Periksa tanah, air tanah dan persyaratan teknis setempat dengan tenaga yang kompeten.');
  result.status = result.reasons.length ? 'INFEASIBLE_WITH_AVAILABLE_DATA' : result.missing.length ? 'MORE_DATA_REQUIRED' : result.conditions.length ? 'FEASIBLE_WITH_CONDITIONS' : 'FEASIBLE_PRELIMINARY';
  return result;
}
