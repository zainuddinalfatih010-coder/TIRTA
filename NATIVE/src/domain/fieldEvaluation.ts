import { unknownNumber, type FieldEvaluation } from './scientificContract';
export function blankFieldEvaluation(id: string, planId: string, planRevision: number): FieldEvaluation {
  const event = () => ({ date: '', rain: unknownNumber('mm'), duration: unknownNumber('minutes'), ponding: 'unknown' as const, locations: '', pondingDuration: unknownNumber('minutes'), note: '', photo: '' });
  return { id, planId, planRevision, before: event(), after: event(), comparable: null, comparisonBasis: '', installedAsPlanned: null, installationNote: '', maintenance: '', condition: 'unknown' };
}
export type FieldAssessment = { status: 'INDICATION_IMPROVED' | 'INSUFFICIENT_DATA' | 'REVIEW_NEEDED'; label: string; explanation: string };
export function fieldNextActions(v: FieldEvaluation): { label: string; reason: string; step: 'rain' | 'interventions' | 'compare' }[] {
  const actions: ReturnType<typeof fieldNextActions> = [];
  if (v.condition === 'clogged' || v.condition === 'damaged' || v.installedAsPlanned !== true) actions.push({ label: 'Tinjau pemasangan & pemeliharaan', reason: 'Catat perbedaan instalasi, inlet, luapan, media dan penyumbatan sebelum memakai kinerja rencana.', step: 'interventions' });
  if (v.comparable !== true || !v.comparisonBasis.trim() || v.before.rain.value === null || v.after.rain.value === null) actions.push({ label: 'Periksa konteks hujan', reason: 'Bandingkan kedalaman, durasi dan kondisi awal. Jangan menyamakan dua hujan hanya karena tanggal pengamatan lengkap.', step: 'rain' });
  if (v.after.ponding === 'observed') actions.push({ label: 'Tinjau sumber dan tujuan air', reason: 'Periksa jalur masuk/luapan serta lokasi genangan. Sisa volume tidak menentukan kedalaman atau penyebab genangan.', step: 'interventions' });
  if (v.installedAsPlanned === true && v.comparable === true) actions.push({ label: 'Bandingkan ulang paket', reason: 'Ubah input hanya jika tersedia dasar baru. Pengamatan tidak otomatis mengubah C atau kapasitas.', step: 'compare' });
  return actions;
}
export function assessFieldEvaluation(v: FieldEvaluation): FieldAssessment {
  const result = (status: FieldAssessment['status'], label: string, explanation: string): FieldAssessment => ({ status, label, explanation });
  if (v.condition === 'clogged' || v.condition === 'damaged' || v.installedAsPlanned === false)
    return result('REVIEW_NEEDED', 'Perlu ditinjau ulang', 'Kondisi atau pemasangan berbeda dari rencana; periksa instalasi sebelum menyimpulkan dampak.');
  if (v.before.date && v.after.date && v.after.date <= v.before.date)
    return result('INSUFFICIENT_DATA', 'Data belum cukup', 'Tanggal sesudah harus lebih akhir dari tanggal sebelum. Catatan tetap disimpan; perbaiki urutan kejadian sebelum menilai perubahan.');
  if (v.before.rain.value === 0 || v.after.rain.value === 0)
    return result('INSUFFICIENT_DATA', 'Data belum cukup', 'Kejadian 0 mm tetap sah sebagai catatan, tetapi tanpa hujan tidak dapat menunjukkan perbaikan penanganan hujan. Gunakan kejadian hujan yang sebanding.');
  if (!v.before.date || !v.after.date || v.before.rain.value === null || v.after.rain.value === null || v.before.ponding === 'unknown' || v.after.ponding === 'unknown' || v.comparable !== true || !v.comparisonBasis.trim() || v.installedAsPlanned !== true || !v.installationNote.trim())
    return result('INSUFFICIENT_DATA', 'Data belum cukup', 'Lengkapi pengamatan, konteks hujan, keterbandingan dan pemasangan. Satu pasangan kejadian bukan bukti sebab-akibat atau validasi model.');
  if (v.before.ponding === 'observed' && v.after.ponding === 'not-observed')
    return result('INDICATION_IMPROVED', 'Ada indikasi membaik', 'Genangan dilaporkan sebelum pemasangan dan tidak setelahnya pada kejadian yang dinyatakan sebanding. Ini pengamatan deskriptif; faktor lain belum disingkirkan.');
  const before = v.before.pondingDuration.value, after = v.after.pondingDuration.value;
  if (v.before.ponding === 'observed' && v.after.ponding === 'observed' && before !== null && after !== null && after < before)
    return result('INDICATION_IMPROVED', 'Ada indikasi membaik', 'Durasi genangan yang dicatat berkurang. Belum membuktikan sebab-akibat atau ketepatan model.');
  if (v.after.ponding === 'observed') return result('REVIEW_NEEDED', 'Perlu ditinjau ulang', 'Genangan masih dilaporkan. Periksa hujan, pemasangan, sambungan dan pemeliharaan; ini bukan otomatis kegagalan intervensi.');
  return result('INSUFFICIENT_DATA', 'Data belum cukup', 'Tidak ada genangan pada kedua catatan bukan bukti perbaikan; perlu kejadian dan pemantauan tambahan.');
}
