import type { ProjectV2 } from './projectV2';
import type { ComponentVariant } from './intervention-contract';
import { assessIntervention, type ScreeningFinding } from './feasibility';
import { scientificNumberSchema } from './scientificContract';
import { fieldObservationGuidance } from './fieldObservations';
import { bioporiInstallationAllowed } from './treatmentDesign';

export type GuidanceId = 'storage' | 'infiltration' | 'biopori' | 'rain-garden' | 'permeable';
export type SiteGuidance = {
  id: GuidanceId;
  name: string;
  /** eligible means ready to explore/configure, never a certified design or a hidden winner. */
  status: 'eligible' | 'needs-data' | 'conflict' | 'retired';
  eventReady: boolean;
  reason: string;
  nextAction: { label: string; step: 'parcel' | 'rain' | 'interventions' | 'compare'; field: string };
  conditions: string[];
};
export type SiteGuidanceContext = { sourceZoneIds?: string[]; installationZoneId?: string | null; componentId?: string; includeResources?: boolean };

const options: { id: GuidanceId; name: string }[] = [
  { id: 'storage', name: 'Tangki' }, { id: 'infiltration', name: 'Sumur / area resapan' },
  { id: 'biopori', name: 'Biopori' }, { id: 'rain-garden', name: 'Taman hujan' },
  { id: 'permeable', name: 'Permukaan berpori' },
];
function matches(c: ComponentVariant, id: GuidanceId) {
  return id === 'biopori' ? c.family === 'infiltration' && c.infiltrationType === 'biopori'
    : id === 'infiltration' ? c.family === 'infiltration' && c.infiltrationType !== 'biopori' : c.family === id;
}
function findingAction(f: ScreeningFinding): SiteGuidance['nextAction'] {
  switch (f.ruleId) {
    case 'SOIL': return { label: 'Periksa bukti tanah lokasi', step: 'interventions', field: 'soil' };
    case 'GROUNDWATER': return { label: 'Tinjau kondisi air tanah', step: 'interventions', field: 'groundwater' };
    case 'MAINTENANCE': return { label: 'Periksa kondisi pemasangan', step: 'interventions', field: 'maintenance' };
    case 'BIOPORI_SITE': return { label: 'Pilih lokasi non-atap', step: 'interventions', field: 'installation' };
    case 'CONNECTION': return { label: 'Periksa sumber dan jalur air', step: 'interventions', field: f.message.includes('luas tangkapan') ? 'catchment' : 'connection' };
    case 'RESOURCE': return { label: 'Periksa biaya dan ruang pemasangan', step: 'interventions', field: 'resources' };
    default: return { label: 'Tinjau kapasitas pada hujan ini', step: 'interventions', field: 'capacity' };
  }
}

/** Site facts change guidance; neither rates nor physical benefits are synthesized here. */
export function siteGuidance(project: ProjectV2, scenarioId: string, context: SiteGuidanceContext = {}): SiteGuidance[] {
  const selected = project.components.find(c => c.id === context.componentId);
  const sources = context.sourceZoneIds ?? selected?.targets ?? project.zones.map(z => z.id);
  const sourceZones = project.zones.filter(z => sources.includes(z.id));
  const installationId = context.installationZoneId ?? selected?.treatment?.installationZoneId;
  const installation = project.zones.find(z => z.id === installationId);
  const observation = fieldObservationGuidance(project, [...sources, ...(installation ? [installation.id] : [])]);
  return options.map(option => {
    const make = (status: SiteGuidance['status'], reason: string, nextAction: SiteGuidance['nextAction'], conditions: string[] = [], eventReady = false): SiteGuidance => ({ ...option, status, eventReady, reason: observation && status !== 'retired' ? `${observation.reason} ${reason}` : reason, nextAction, conditions: observation && status !== 'retired' ? [observation.nextQuestion, ...conditions] : conditions });
    if (!project.scenarios.some(s => s.id === scenarioId)) return make('needs-data', 'Pilih hujan yang akan diuji terlebih dahulu.', { label: 'Pilih skenario hujan', step: 'rain', field: 'scenario' });
    if (sources.some(id => !project.zones.some(z => z.id === id))) return make('needs-data', 'Ada zona sumber yang sudah tidak tersedia.', { label: 'Pilih ulang sumber air', step: 'interventions', field: 'connection' });
    const c = selected && matches(selected, option.id) ? selected : undefined;
    if (c) {
      if (!c.enabled) return make('needs-data', 'Penanganan ini masih berupa draft nonaktif.', { label: 'Tinjau dan aktifkan penanganan', step: 'interventions', field: 'draft' });
      const f = assessIntervention(project, c, scenarioId, project.parameters, undefined, context.includeResources === true, [c]);
      const blocker = f.reasons[0];
      if (blocker) return make('conflict', blocker.message, findingAction(blocker), f.conditions.map(x => x.message));
      const missing = f.missing[0];
      if (missing) return make('needs-data', missing.message, findingAction(missing), f.conditions.map(x => x.message));
      return make('eligible', 'Penanganan dapat dihitung pada hujan ini berdasarkan kapasitas dan hubungan sumber yang dinyatakan.', { label: context.includeResources ? 'Bandingkan paket' : 'Lihat dampak penanganan', step: context.includeResources ? 'compare' : 'interventions', field: context.includeResources ? 'comparison' : 'impact' }, f.conditions.map(x => x.message), true);
    }
    if (option.id === 'permeable') {
      const paved = sourceZones.find(z => z.surface === 'paved');
      if (!paved) return make('needs-data', 'Pilih satu zona Beton/Aspal yang akan diubah menjadi permukaan berpori.', { label: 'Pilih zona Beton/Aspal', step: 'interventions', field: 'source' });
      return make('eligible', 'Konversi permukaan berpori dapat dieksplorasi pada zona Beton/Aspal; luas konversi dan kapasitas kejadian tetap harus dinyatakan.', { label: 'Isi luas dan kapasitas konversi', step: 'interventions', field: 'capacity' }, ['Kelas permukaan atau luas saja tidak menetapkan kapasitas infiltrasi tambahan.']);
    }
    const clogged = sourceZones.find(z => z.surface === 'porous' && project.science?.surfaces[z.id]?.porous.clogging === 'observed');
    if (clogged) return make('needs-data', `Penyumbatan tercatat pada ${clogged.name}. Periksa kesesuaian koefisien kondisi sekarang sebelum memakai hasil.`, { label: 'Tinjau kondisi permukaan', step: 'parcel', field: 'surface-condition' });
    if (option.id === 'storage') {
      const roof = sourceZones.find(z => z.surface === 'roof');
      const roofs = sourceZones.filter(z => z.surface === 'roof');
      if (!sourceZones.length) return make('needs-data', 'Pilih sumber air yang ingin ditampung.', { label: 'Pilih sumber air', step: 'interventions', field: 'connection' });
      if (roofs.some(z => {
        const r = project.science?.surfaces[z.id]?.roof;
        return r?.form === 'mixed' || r?.form === 'sloped' || (r?.pitch?.value ?? 0) > 0;
      })) return make('needs-data', 'Pastikan luas atap berupa proyeksi horizontal dan seluruh bagian yang dipilih terhubung. Kemiringan tidak otomatis menambah volume hujan.', { label: 'Periksa luas dan tangkapan atap', step: 'parcel', field: 'catchment' });
      if (roofs.some(z => {
        const outlet = project.science?.surfaces[z.id]?.roof.outlet;
        return !outlet || outlet === 'unknown' || outlet === 'edge' || outlet === 'mixed';
      })) return make('needs-data', 'Periksa bagian atap yang airnya dapat dialirkan ke tangki. Tepi atap atau beberapa outlet tidak otomatis melayani seluruh atap.', { label: 'Periksa jalur pengumpulan air', step: 'interventions', field: 'connection' });
      return make('eligible', roof ? 'Air atap dengan jalur pengumpulan dapat dieksplorasi untuk tampungan.' : 'Tampungan dapat dieksplorasi jika sumber dapat disalurkan; penggunaan dan kualitas air perlu ditinjau.', { label: 'Isi ruang tampung tersedia', step: 'interventions', field: 'capacity' }, ['Ruang tersedia saat hujan harus dinyatakan; ukuran nominal bukan otomatis ruang kosong.']);
    }
    if (option.id === 'biopori' && installation && !bioporiInstallationAllowed(installation.surface)) return make('conflict', 'Biopori tidak dapat dipasang pada Atap. Zona sumber boleh berbeda.', { label: 'Pilih lokasi non-atap', step: 'interventions', field: 'installation' });
    if (!installation) return make('needs-data', 'Tentukan lokasi pemasangan; jenis zona sumber tidak membuktikan kondisi tanah lokasi.', { label: 'Pilih lokasi pemasangan', step: 'interventions', field: 'installation' });
    const siteEvidence = project.components.filter(v => v.enabled && v.family !== 'storage' && v.treatment?.installationZoneId === installation.id).map(v => project.science?.interventions[v.id]);
    // A known contradiction is not masked by a different missing observation at the same site.
    if (siteEvidence.some(e => e?.groundwaterAssessment === 'unsuitable')) return make('conflict', 'Tinjauan pada lokasi ini menyatakan kondisi air tanah tidak sesuai untuk resapan yang dimodelkan.', { label: 'Tinjau lokasi atau pilihan tampungan', step: 'interventions', field: 'groundwater' });
    const soil = project.science?.surfaces[installation.id]?.soil;
    const validSoil = soil?.infiltration && scientificNumberSchema.safeParse(soil.infiltration).success && soil.infiltration.value !== null;
    if (validSoil && soil.infiltration.value === 0) return make('conflict', 'Bukti lokasi menyatakan infiltrasi nol; belum ada dasar kredit resapan.', { label: 'Tinjau pilihan tampungan', step: 'interventions', field: 'soil' });
    if (!validSoil) return make('needs-data', soil?.compaction === 'compacted' ? 'Tanah padat tercatat. Periksa infiltrasi lokasi; kapasitas tidak diturunkan dari kepadatan atau tekstur.' : 'Bukti infiltrasi lokasi belum tersedia; tanah terbuka atau vegetasi saja tidak membuktikan kapasitas resapan.', { label: 'Periksa bukti tanah lokasi', step: 'interventions', field: 'soil' });
    return make('needs-data', 'Tanah memiliki bukti awal, tetapi kapasitas penanganan dan kesesuaian air tanah pada lokasi ini masih perlu dinyatakan.', { label: 'Tinjau kapasitas dan air tanah', step: 'interventions', field: 'capacity' }, ['Tidak ada kapasitas otomatis dari laju tanah, jumlah lubang, luas, atau jenis tanaman.']);
  });
}
