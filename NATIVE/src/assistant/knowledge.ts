import { authoritativeReferences, evidenceForClaim, scientificClaims } from '../domain/evidenceRegistry';

export type HelpDestination = 'studio' | 'rain' | 'interventions' | 'alternatives' | 'project';
export type KnowledgeItem = {
  id: string; title: string; terms: string[]; explanation: string;
  claimId?: string; destination?: HelpDestination; action?: string;
};
// Reviewed application instructions / existing claim wording, not fabricated full-text passages.
export const appKnowledge: KnowledgeItem[] = [
  { id: 'zone', title: 'Membuat dan mengubah zona', terms: ['zona', 'persil', 'gambar', 'titik'], explanation: 'Buka Studio Persil, pilih Zona, lalu gambarkan area di dalam batas persil. Pilih satu zona untuk mengubah permukaan dan koefisiennya. Luas dihitung dari bentuk zona dan skala persil.', destination: 'studio', action: 'Buka Studio Persil' },
  { id: 'delete', title: 'Hapus dan urungkan zona', terms: ['hapus', 'delete', 'undo', 'balikin'], explanation: 'Pilih zona yang ingin dihapus, lalu gunakan Hapus atau tombol Delete pada keyboard. Periksa konfirmasi. Undo mengembalikan perubahan geometri yang tersedia di Studio.', destination: 'studio', action: 'Buka Studio Persil' },
  { id: 'save', title: 'Penyimpanan proyek', terms: ['simpan', 'reload', 'backup', 'cadangan', 'browser'], explanation: 'Gunakan Simpan pada menu tindakan proyek. Proyek disimpan di browser perangkat ini; browser atau alamat web lain dapat memiliki simpanan berbeda. Cadangan proyek membantu memindahkan data tanpa sinkronisasi cloud.', destination: 'project', action: 'Buka proyek & cadangan' },
  { id: 'coefficient', title: 'Memilih koefisien limpasan', terms: ['koefisien', 'coefficient', 'nilai c', 'mengapa c', 'berapa c'], explanation: 'C menyatakan bagian hujan yang menjadi limpasan dalam model. Pilih permukaan, buka patokan, kemudian konfirmasi nilai beserta sumber atau asumsi. Jenis permukaan tidak menetapkan C otomatis.', claimId: 'CLAIM-VOLUME', destination: 'studio', action: 'Lengkapi data zona' },
  { id: 'rain', title: 'Skenario uji dan data hujan', terms: ['hujan', 'rainfall', 'mm', 'skenario'], explanation: 'Pilih Skenario uji saya untuk angka yang Anda tentukan sendiri; itu dicatat sebagai asumsi. Data / referensi hujan memerlukan sumber. Kosong berarti belum diketahui, sedangkan 0 mm berarti tanpa hujan.', claimId: 'CLAIM-VOLUME', destination: 'rain', action: 'Buka hujan' },
  { id: 'runoff', title: 'Cara menghitung limpasan', terms: ['limpasan', 'runoff', 'rumus', 'volume'], explanation: 'Volume hujan = luas × kedalaman hujan / 1.000. Limpasan = volume hujan × C. Luas dalam m², hujan dalam mm, hasil dalam m³. Bagian non-limpasan tidak otomatis seluruhnya infiltrasi.', claimId: 'CLAIM-VOLUME', destination: 'rain', action: 'Lihat hasil hujan' },
  { id: 'tank', title: 'Tampungan belum berarti air telah digunakan', terms: ['tangki', 'tandon', 'ditampung', 'pemanfaatan'], explanation: 'Isi sumber air, kapasitas yang tersedia, biaya, lahan, dan rencana penggunaan atau pengosongan tangki. Air tertampung masih perlu ditangani setelah hujan; air yang sama tidak dihitung lagi sebagai penggunaan selama kejadian.', claimId: 'CLAIM-STORAGE', destination: 'interventions', action: 'Atur intervensi' },
  { id: 'infiltration', title: 'Resapan memerlukan pemeriksaan lokasi', terms: ['resapan', 'biopori', 'infiltrasi', 'sumur'], explanation: 'Kapasitas resapan dan kesesuaian tanah harus didukung data lokasi. Jumlah lubang saja tidak membuktikan kapasitas. Area sumber limpasan dan lokasi pemasangan memiliki fungsi berbeda.', claimId: 'CLAIM-SOIL', destination: 'interventions', action: 'Periksa intervensi' },
  { id: 'garden', title: 'Vegetasi biasa berbeda dari taman hujan', terms: ['vegetasi', 'rain garden', 'taman hujan', 'tanaman'], explanation: 'Vegetasi yang ada sudah diperhitungkan pada limpasan awal. Taman hujan membutuhkan media, lahan, penyaluran air, pemeliharaan, dan kapasitas tambahan yang didukung data. Memilih kelas Vegetasi saja tidak membuktikan kapasitas taman hujan.', claimId: 'CLAIM-BIO-MEDIA', destination: 'interventions', action: 'Periksa taman hujan' },
  { id: 'roof', title: 'Kemiringan tidak memilih C otomatis', terms: ['kemiringan', 'genteng', 'sudut', 'atap miring'], explanation: 'Luas penangkap hujan perlu dibedakan dari luas genteng miring. Sudut atap tidak menetapkan C secara otomatis. Catat kemiringan dan basis luas, lalu konfirmasi koefisien sesuai bukti yang tersedia.', destination: 'studio', action: 'Periksa data atap' },
];
export function lookupKnowledge(question: string) {
  const text = question.toLocaleLowerCase('id-ID').normalize('NFKC');
  return appKnowledge.map(item => ({ item, score: item.terms.reduce((sum, term) => sum + (text.includes(term) ? term.length : 0), 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0]?.item ?? null;
}
export function sourcesFor(claimIds: readonly string[]) {
  return [...new Map(claimIds.flatMap(id => evidenceForClaim(id)).map(source => [source.id, source])).values()];
}
export function referenceFor(id: string) {
  return authoritativeReferences.find(item => item.id === id) ?? scientificClaims.flatMap(c => evidenceForClaim(c.id)).find(item => item.id === id);
}
export function retrieveClaims(question: string) {
  const topic = lookupKnowledge(question);
  const selected = topic?.claimId ? scientificClaims.filter(c => c.id === topic.claimId) : scientificClaims.filter(c => ['CLAIM-VOLUME', 'CLAIM-STORAGE', 'CLAIM-CONNECTION'].includes(c.id));
  return selected.slice(0, 4).map(c => ({ id: c.id, text: c.wording, scope: c.scope, limitation: c.limitations, sourceIds: c.evidenceIds }));
}
