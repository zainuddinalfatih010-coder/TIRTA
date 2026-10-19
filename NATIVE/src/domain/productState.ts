import type { ProjectV2 } from './projectV2';
import type { ComponentVariant } from './intervention-contract';
import { assessIntervention } from './feasibility';
import { fieldDecisionReadiness } from './fieldDecisionReadiness';
import { planningParameterValue } from './planningEngine';
import { packageResources } from './treatmentEditing';
import { referencedSoil } from './treatmentDesign';

export type RequirementGroup = 'connection' | 'capacity' | 'site' | 'resources';
export type Requirement = { field: string; label: string; value: string; status: 'known' | 'missing' | 'invalid'; required: boolean; why: string; consequence: 'water' | 'comparison' | 'field'; message?: string };
export type RequirementSection = { id: RequirementGroup; label: string; rows: Requirement[] };
const number = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 6 });
/** Complete presentation map, including requirements the fail-fast engine has not reached.
 * Validator findings own eligibility. These rows never grant a readiness bypass. */
export function treatmentRequirements(p: ProjectV2, c: ComponentVariant, sid: string): RequirementSection[] {
  const check = assessIntervention(p, c, sid);
  const evidence = p.science?.interventions[c.id];
  const biopori = c.family === 'infiltration' && c.infiltrationType === 'biopori';
  const permeable = c.family === 'permeable';
  const basis = evidence?.performance[sid];
  const value = (ref: ComponentVariant['totalCost'], suffix: string) => {
    try { return `${number(planningParameterValue(p.parameters, ref, ref.unit, 'Isian'))} ${suffix}`.trim(); }
    catch { return ''; }
  };
  const row = (field: string, label: string, text: string, why: string, consequence: Requirement['consequence'], rules: string[] = [], required = true) => {
    const matches = (f: {field?: string; ruleId: string}) => f.field === field || (!f.field && rules.includes(f.ruleId));
    const reason = check.reasons.find(matches);
    const missingFinding = check.missing.find(matches);
    const status: Requirement['status'] = reason ? 'invalid' : !text || missingFinding ? 'missing' : 'known';
    return {field,label,value:text || 'Belum diisi',status,required,why,consequence,message:reason?.message ?? missingFinding?.message};
  };
  const names = c.targets.map(id => p.zones.find(z => z.id === id)?.name ?? 'Zona terhapus').join(', ');
  const zone = p.zones.find(z => z.id === c.treatment?.installationZoneId);
  const connection = [
    row('source',permeable?'Zona yang diubah':'Sumber air',names,permeable?'Menentukan satu zona Beton/Aspal yang akan dikonversi; ini bukan sumber air kedua.':'Menentukan zona yang limpasan airnya ditangani.', 'water'),
    row('installation','Lokasi pemasangan',zone?.name ?? '',biopori ? 'Biopori dapat dipasang pada semua jenis permukaan kecuali Atap; lokasi berbeda dari sumber air.' : 'Rincian lokasi penerapan. Ruang yang dialokasikan diperiksa terpisah; posisi simbol bukan bukti pemasangan.', biopori ? 'water' : 'field', ['BIOPORI_SITE'],biopori),
    row('via','Jalur air',p.science?.connections.filter(link => link.candidateId === c.id && c.targets.includes(link.sourceZoneId)).every(link => link.via !== 'unknown') && c.targets.length && p.science?.connections.some(link => link.candidateId === c.id) ? 'Dinyatakan' : '', 'Periksa penyaluran fisik sebelum penerapan; hitungan memakai sumber yang dipilih.', 'field', ['CONNECTION'],false),
  ];
  // Shared-source decisions become required only when sources actually overlap.
  if (!permeable && p.components.some(other => other.id !== c.id && other.enabled && other.targets.some(id => c.targets.includes(id)))) {
    connection.push(row('sharedSourceMode','Sumber bersama',c.treatment?.sharedSourceMode !== 'unresolved' ? ({alternative:'Alternatif terpisah',ledger:'Penanganan berurutan',parallel:'Pembagian paralel'} as Record<string,string>)[c.treatment?.sharedSourceMode??''] ?? '' : '', 'Memisahkan alternatif yang saling menggantikan dari penanganan berurutan; air tidak dihitung dua kali.', 'water'));
  }
  const overflow=evidence?.overflow;
  const destination=overflow?.kind==='zone'?p.zones.find(z=>z.id===overflow.id)?.name:overflow?.kind==='intervention'?p.components.find(item=>item.id===overflow.id&&item.enabled)?.name:overflow?.kind==='drainage'?'Saluran':overflow?.kind==='outside'?'Keluar persil':'';
  connection.push(row('connection','Tujuan luapan',destination??'', 'Tujuan luapan diperiksa sebelum penerapan. Tujuan yang sudah terhapus atau nonaktif harus diperbaiki; sambungan tidak dipulihkan otomatis.', 'field', [], false));
  const perf = c.performanceByScenario[sid];
  const ref = perf && ('availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
  const effectiveRef = ref && (p.scenarios.find(s => s.id === sid)?.overrides.find(o => o.baseParameterId === ref.id)?.replacement ?? ref);
  const capacity = [
    row('capacity','Kapasitas kejadian',effectiveRef ? value(effectiveRef,'m³/kejadian') : '',c.family === 'storage' ? 'Ruang kosong yang tersedia saat hujan mulai; kapasitas nominal bukan ruang kosong.' : 'Batas air yang dapat diresapkan pada satu hujan; jumlah lubang atau luas tidak otomatis menentukan kapasitas.', 'water'),
    row('capacitySource','Asal angka',effectiveRef ? p.parameters.find(v => v.id === effectiveRef.id)?.source ?? '' : '', 'Menjaga angka tetap dapat ditelusuri. Asumsi boleh dinyatakan; tidak dianggap pengukuran.', 'water'),
    row('capacityBasis','Dasar kinerja',basis?.origin && basis.origin !== 'unknown' ? ({'user-entered':'Asumsi pengguna',measured:'Pengukuran','literature-guided':'Acuan','design-declared':'Rencana teknis'} as Record<string,string>)[basis.origin] ?? 'Tinjauan tersimpan' : '', 'Tinjauan yang dinyatakan harus sesuai angka dan konteks hujan.', check.missing.some(f=>f.field==='capacityBasis')?'water':'field',[],check.missing.some(f=>f.field==='capacityBasis')),
  ];
  if (basis?.origin === 'measured') capacity.push(row('performanceMethod','Metode & tanggal',basis.method && basis.date ? `${basis.method} · ${basis.date}` : '', 'Pengukuran memerlukan metode dan tanggal agar dapat ditinjau.', 'water'));
  if (c.family !== 'storage' && basis && basis.origin !== 'unknown') capacity.push(row('performanceContext','Konteks hujan','Tinjauan tersimpan', 'Perubahan tinggi atau durasi hujan memerlukan peninjauan ulang kapasitas resapan.', 'water'));
  if (c.family === 'storage' && evidence?.nominalTankCapacity.value != null) capacity.push(row('nominal','Batas ukuran tangki',`${number(evidence.nominalTankCapacity.value)} m³`, 'Ruang kosong tidak boleh melebihi ukuran nominal yang dinyatakan.', 'water'));
  const soil = evidence ? referencedSoil(p,c,evidence) : null;
  const site: Requirement[] = c.family === 'storage' ? [] : [
    row('soil','Bukti infiltrasi tanah',soil?.number?.value != null ? `${number(soil.number.value)} mm/jam` : '', 'Verifikasi sebelum penerapan. Angka tanah tidak otomatis menjadi kapasitas intervensi.', 'field', ['SOIL'],false),
    row('groundwater','Kondisi air tanah',evidence?.groundwaterAssessment === 'unknown' ? '' : evidence?.groundwaterBasis ?? '', 'Verifikasi sebelum penerapan; kondisi yang dinyatakan tidak sesuai tetap menghalangi kredit resapan.', 'field', ['GROUNDWATER'],false),
  ];
  if(c.family!=='storage')site.push(row('standard','Persyaratan setempat',evidence?.localStandardReview !== 'unknown' ? evidence?.localStandardBasis ?? '' : '', 'Diperiksa sebelum penerapan; bukan syarat untuk menyimpan draf.', 'field', ['STANDARD'], false));
  site.push(
    row('condition','Kondisi instalasi',evidence?.condition==='maintained'?'Terawat':evidence?.condition==='clogged'?'Tersumbat':evidence?.condition==='damaged'?'Rusak':'', 'Kinerja instalasi yang rusak atau tersumbat tidak boleh digunakan kembali tanpa tinjauan.', 'field', ['MAINTENANCE'], false),
    row('maintenance','Pemeliharaan',evidence?.maintenance ?? '', 'Sumbatan atau kerusakan dapat menggugurkan kinerja. Rencana pemeliharaan diperlukan sebelum pemasangan.', 'field', ['MAINTENANCE'], false),
    row('field','Pemeriksaan lokasi',evidence?.fieldVerified ? evidence.verificationSource : '', 'Menandai pemeriksaan lapangan, bukan sertifikasi keselamatan.', 'field', ['FIELD'], false),
  );
  if (c.family === 'rain-garden') site.push(row('media','Media & tanaman',evidence?.media && evidence.vegetation ? 'Dinyatakan' : '', 'Rencana media dan tanaman diperlukan sebelum penerapan. Perhitungan memakai kapasitas yang Anda nyatakan.', 'field', ['MEDIA'], false));
  if (c.family === 'storage') site.push(row('operation','Penggunaan & pengosongan',c.waterUse !== 'unknown' && c.drawdown !== 'unknown' ? 'Direncanakan' : '', 'Menjaga ruang tersedia untuk hujan berikutnya; tidak mengubah neraca kejadian ini.', 'field', [], false));
  const allocation=p.installationSites.find(s=>s.id===c.installationSiteId);
  const resources = [
    row('cost','Biaya',value(c.totalCost,'Rp'),'Dibandingkan dengan batas anggaran; kosong berbeda dari biaya nol.', 'comparison'),
    row('area','Ruang pemasangan',value(c.occupiedArea,'m²'),'Memeriksa ruang yang dipakai dan luas lokasi; bukan luas sumber limpasan.', 'comparison'),
    row('budget','Batas anggaran',value(p.constraints.budget,'Rp'),'Menentukan paket mana yang berada dalam batas biaya Anda.', 'comparison'),
    row('land','Batas lahan',value(p.constraints.usableArea,'m²'),'Menentukan paket yang sesuai ruang tersedia.', 'comparison'),
    row('allocatedSpace','Alokasi ruang',allocation?value(allocation.availableArea,'m²'):value(p.constraints.usableArea,'m²'),'Alokasi pra-perencanaan berasal dari batas lahan yang Anda nyatakan; bukan pengukuran atau kelayakan teknis lokasi.', 'comparison'),
  ];
  return [{id:'connection',label:'Hubungan air',rows:connection},{id:'capacity',label:'Kapasitas',rows:capacity},{id:'site',label:'Kondisi lokasi',rows:site},{id:'resources',label:'Biaya & lahan',rows:resources}];
}

/** Canonical product projection. Hydrology, constraints and eligibility stay in their engines. */
export function productState(p: ProjectV2 | null, sid: string, editingId?: string) {
  const decision = fieldDecisionReadiness(p,sid);
  return {decision,resources:p ? packageResources(p) : null,selected:decision.selected.status,
    treatments:p?.components.map(c => {
      const readiness = decision.treatments.find(t => t.id === c.id)!;
      const sections = treatmentRequirements(p,c,sid);
      return {...readiness,lifecycle:c.id === editingId ? 'editing' as const : c.enabled ? 'committed' as const : 'deferred' as const,
        relationshipReady:!sections.find(s => s.id === 'connection')!.rows.some(r => r.consequence === 'water' && r.status !== 'known'),
        siteVerificationReady:!sections.filter(s=>s.id==='site'||s.id==='connection').flatMap(s=>s.rows).some(r => r.consequence==='field'&&r.status !== 'known'),sections};
    }) ?? []};
}

