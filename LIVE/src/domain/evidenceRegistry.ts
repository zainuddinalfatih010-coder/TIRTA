import { journalEvidence } from './evidenceCatalog';

export type EvidenceRecord = {
  id: string; category: 'journal-core' | 'journal-reserve'; peerReviewed: boolean;
  authors: string[]; year: number; title: string; journal: string; doi: string; url: string;
  studyType: string; geography: string; climate: string; topics: string[];
  claimsSupported: string[]; limitations: string; localRelevance: string;
  verification: 'publisher-abstract' | 'bibliographic-and-scope'; reviewedOn: string;
};
export const authoritativeReferences = [
  { id: 'GUIDE-NSW-ROOF-AREA', category: 'guide', title: 'NSW Government BASIX — Rainwater Harvesting Systems: measuring roof catchment area', url: 'https://www.planningportal.nsw.gov.au/basix/water/design-principles/rainwater-harvesting-systems', limitation: 'Luas penangkap hujan diukur pada bidang horizontal. Dipakai untuk membedakan proyeksi horizontal dari luas genteng miring; bukan aturan lokal Indonesia, nilai C, hubungan sudut–C atau desain talang otomatis. Halaman resmi diverifikasi 5 Oktober 2026.' },
  { id: 'STUDY-BIOPORI-2014', category: 'study', title: 'Sari, Qomariyah & Sobriyah (2014) — Pengaruh jumlah lubang resapan biopori pada infiltrasi dan limpasan', url: 'https://jurnal.uns.ac.id/matriks/article/view/37416', limitation: 'Teks penuh ditinjau: percobaan simulator hujan pada tanah lanau berpasir, bukan instalasi sekolah. Hanya mendukung konteks resapan; ukuran percobaan dan volume hasil tidak digunakan sebagai desain atau kapasitas per lubang.' },
  { id: 'STD-SNI-8456-2025', category: 'standard', title: 'SNI 8456:2025 — Sumur dan parit resapan air hujan', url: 'https://pesta.bsn.go.id/produk/detail/84562025-sni8456%3A2025', limitation: 'Keberadaan edisi 2025 terverifikasi pada katalog resmi BSN, 4 Oktober 2026. Isi normatif belum ditinjau. Tinjauan teknis setempat harus menyebut edisi yang dipakai; tidak ada angka atau klaim kepatuhan otomatis.' },
  { id: 'STD-SNI-8456-2017', category: 'standard', title: 'SNI 8456:2017 — Sumur dan parit resapan air hujan', url: 'https://pesta.bsn.go.id/produk/detail/12656-sni84562017', limitation: 'Katalog BSN terverifikasi. Isi normatif berlisensi belum ditinjau; tidak ada ambang numerik SNI yang diterapkan otomatis.' },
  { id: 'METHOD-EPA-VOLUME', category: 'method', title: 'US EPA — Stormwater Best Management Practice Design Guide, Volume 1 (2004), Appendix B', url: 'https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=901X0A00.TXT', limitation: 'Hubungan volume kejadian, bukan debit puncak; C tetap input pengguna, bukan kalibrasi lokasi.' },
  { id: 'GUIDE-TXDOT', category: 'guidance', title: 'TxDOT Hydraulic Design Manual — Rational Method, Table 4-10', url: 'https://www.txdot.gov/manuals/des/hyd/chapter-4--hydrology/section-12--rational-method.html', limitation: 'Koefisien untuk konteks debit puncak; penggunaan volumetrik hanya asumsi pra-perencanaan yang dipilih pengguna.' },
  { id: 'REPORT-USGS-2018', category: 'report', title: 'Selbig & Buer (2018) — USGS SIR 2018-5037', url: 'https://pubs.usgs.gov/publication/sir20185037', limitation: 'Laporan pemerintah, tidak dihitung dalam minimum jurnal; bukan satu C universal permukaan berpori.' },
] as const;
export type ScientificClaim = { id: string; wording: string; scope: string; evidenceIds: string[]; limitations: string; uiLocations: string[] };
const claim = (id: string, wording: string, scope: string, evidenceIds: string[], limitations: string, uiLocations: string[]): ScientificClaim => ({ id, wording, scope, evidenceIds, limitations, uiLocations });
export const scientificClaims: ScientificClaim[] = [
  claim('CLAIM-VOLUME', 'Volume hujan = luas × kedalaman / 1.000; limpasan = volume hujan × C.', 'Neraca volume kejadian dalam m³, luas m² dan kedalaman mm.', ['METHOD-EPA-VOLUME'], 'Bukan Rational Method debit puncak. Non-limpasan bukan otomatis infiltrasi.', ['Hujan', 'Bandingkan', 'Ringkasan']),
  claim('CLAIM-VOLUME-LIMIT', 'Neraca volume tanpa pola waktu tidak menentukan debit puncak atau genangan.', 'Batas model TIRTA.', ['J-HYDRO-2012', 'J-URBAN-2013'], 'Durasi menghasilkan intensitas rata-rata saja, bukan peak.', ['Hujan', 'Rencana & Dampak']),
  claim('CLAIM-CONNECTION', 'Sumber yang diarahkan dan ruang tampung tersedia menentukan air yang dapat ditangani tangki.', 'Hubungan sumber yang dinyatakan pengguna dan ledger konservatif.', ['J-RWH-2017'], 'Deklarasi bukan survei sambungan/hidraulik; jarak marker tidak membuktikan koneksi.', ['Intervensi', 'Rencana & Dampak']),
  claim('CLAIM-STORAGE', 'Ruang tampung kosong dan penggunaan air perlu dibedakan dari kapasitas nominal.', 'Tangki per event.', ['J-RWH-2017'], 'Reuse setelah event tidak memberi kredit tambahan pada event yang sama.', ['Intervensi', 'Rencana & Dampak']),
  claim('CLAIM-SOIL', 'Kondisi fisik dan sifat hidraulik tanah memengaruhi infiltrasi.', 'Tanah dan tanah di bawah vegetasi.', ['J-SOIL-2008', 'J-JAKARTA-2026'], 'Nama/tekstur/foto bukan pengganti bukti infiltrasi lapangan.', ['Studio', 'Intervensi']),
  claim('CLAIM-GROUNDWATER', 'Kondisi air tanah dan permeabilitas membatasi kelayakan resapan.', 'Penyaringan sumur/area resapan, bukan desain geoteknik.', ['J-JAKARTA-2026', 'STD-SNI-8456-2017', 'STD-SNI-8456-2025'], 'Tentukan edisi standar dalam tinjauan setempat. Tidak menerapkan angka SNI dari katalog; relevansi lokasi perlu diperiksa.', ['Intervensi', 'Alternatif']),
  claim('CLAIM-BIOPORI', 'Lubang resapan biopori adalah pilihan jenis resapan, bukan pengganti semua perkerasan berpori.', 'Resapan tambahan per kejadian dengan kapasitas total yang dinyatakan.', ['STUDY-BIOPORI-2014'], 'Percobaan laboratorium bukan bukti kapasitas lokasi. Tidak ada perkalian jumlah lubang dengan angka universal; jangan menghitung air yang sudah ditangani dua kali.', ['Intervensi', 'Dasar TIRTA']),
  claim('CLAIM-BIO-MEDIA', 'Media, tanah, tanaman, storage dan sumber air memengaruhi respons bioretensi.', 'Penyaringan taman hujan.', ['J-BIO-2008', 'J-BIO-HYDRO-2012', 'J-BIO-REVIEW-2009'], 'Belum merupakan desain lapisan konstruksi atau performance guarantee.', ['Intervensi', 'Alternatif']),
  claim('CLAIM-POROUS', 'Kinerja perkerasan berpori bergantung pada sistem, lapisan dan kondisi lokasi.', 'Perkerasan yang sudah ada dan penggantian perkerasan Beton/Aspal.', ['J-POROUS-2007', 'J-POROUS-REVIEW-2013', 'J-SYSTEM-2014'], 'Kapasitas permukaan saja tidak menjelaskan seluruh sistem. Manfaat baseline tidak boleh dihitung ulang.', ['Studio', 'Intervensi']),
  claim('CLAIM-MAINTENANCE', 'Penyumbatan dan pemeliharaan dapat mengubah respons instalasi.', 'Konteks perawatan, tanpa koefisien degradasi otomatis.', ['J-MAINTENANCE-2016', 'J-AGING-2020'], 'Tidak semua perubahan merupakan kegagalan; diperlukan observasi lokasi.', ['Studio', 'Intervensi', 'Evaluasi lapangan']),
  claim('CLAIM-VEGETATION', 'Vegetasi berinteraksi melalui intersepsi, evapotranspirasi dan konteks infiltrasi.', 'Metadata tutupan, bukan family tambahan.', ['J-TREES-2017'], 'Jenis tanaman tidak menetapkan kapasitas numerik.', ['Studio', 'Intervensi']),
  claim('CLAIM-ROOF', 'Bentuk, material dan kemiringan atap dicatat sebagai konteks; luas penangkap hujan adalah proyeksi horizontal.', 'Bentuk/material/kemiringan/sumber air.', ['GUIDE-NSW-ROOF-AREA', 'J-ROOF-2012', 'J-ROOF-REVIEW-2010'], 'Kemiringan tidak memberi C atau pengali volume otomatis. Studi atap hijau tidak dipakai sebagai C otomatis atap biasa; desain talang dan debit puncak belum dimodelkan.', ['Studio']),
  claim('CLAIM-DURATION', 'Pola dan durasi kejadian memengaruhi respons; depth saja tidak menjelaskan waktu.', 'P = kedalaman; rata-rata intensitas = P / jam durasi.', ['J-RAIN-2013', 'J-URBAN-2013'], 'Tidak menghasilkan hydrograph, L/s atau peak dari rata-rata.', ['Hujan']),
  claim('CLAIM-PARETO', 'Beberapa ukuran dapat menghasilkan pilihan non-dominated yang berbeda.', 'Residual, biaya dan lahan, finite deterministic enumeration.', ['J-PARETO-2018'], 'Studi memakai SWMM/optimizer berbeda; TIRTA tidak mengadopsi atau tervalidasi oleh studi tersebut.', ['Alternatif', 'Bandingkan']),
  claim('CLAIM-LOCAL', 'Konteks iklim, lokasi dan sistem membatasi transfer praktik ke persil lain.', 'Indonesia/tropis dan transfer evidence.', ['J-IKN-2024', 'J-SINGAPORE-2017'], 'Hasil kawasan/pilot bukan angka default sekolah.', ['Intervensi', 'Dasar ilmiah']),
  claim('CLAIM-FIELD', 'Pemantauan setelah pemasangan memberi observasi, bukan bukti sebab-akibat dari satu pasangan event.', 'Evaluasi lapangan deskriptif.', ['J-BIO-2008', 'J-AGING-2020', 'J-POROUS-2003'], 'Hujan, kondisi awal dan metode yang berbeda membatasi perbandingan; bukan validasi model.', ['Evaluasi lapangan', 'Ringkasan']),
];
export function evidenceForClaim(id: string) {
  const item = scientificClaims.find(c => c.id === id);
  return item?.evidenceIds.map(e => journalEvidence.find(r => r.id === e) ?? authoritativeReferences.find(r => r.id === e)).filter(x => x !== undefined) ?? [];
}
export function validateEvidenceRegistry(): string[] {
  const issues: string[] = [];
  const all = [...journalEvidence, ...authoritativeReferences];
  const ids = new Set(all.map(e => e.id));
  if (ids.size !== all.length) issues.push('Duplicate evidence IDs');
  if (journalEvidence.filter(e => e.category === 'journal-core' && e.peerReviewed).length < 20) issues.push('Fewer than20 core journal sources');
  if (journalEvidence.filter(e => e.category === 'journal-reserve' && e.peerReviewed).length < 5) issues.push('Fewer than5 reserve journal sources');
  if (new Set(journalEvidence.map(e => e.doi.toLowerCase())).size !== journalEvidence.length) issues.push('Duplicate DOIs');
  for (const e of journalEvidence) {
    if (!e.authors.length || !e.journal || !e.title || !/^10\./.test(e.doi) || !e.limitations || !e.localRelevance) issues.push(`Incomplete evidence: ${e.id}`);
    for (const c of e.claimsSupported) if (!scientificClaims.some(x => x.id === c)) issues.push(`Unknown claim ${c}`);
  }
  for (const c of scientificClaims) for (const id of c.evidenceIds) if (!ids.has(id)) issues.push(`Missing evidence ${id}`);
  return issues;
}
