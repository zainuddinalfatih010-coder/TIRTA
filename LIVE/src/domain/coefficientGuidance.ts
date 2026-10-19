import type { Surface } from "./model";

export type CoefficientRange = { label: string; low: number; high: number };
export type CoefficientGuide = { ranges: CoefficientRange[]; note: string; source: string; url: string };
const txdot = {
  source: "TxDOT Hydraulic Design Manual (2019) · §12 · Table 4-10",
  url: "https://www.txdot.gov/manuals/des/hyd/chapter-4--hydrology/section-12--rational-method.html",
};
export const coefficientGuidance: Record<Surface, CoefficientGuide> = {
  roof: { ...txdot, ranges: [{ label: "Atap", low: .75, high: .95 }], note: "Tabel tidak merinci kondisi atap untuk ujung rendah/tinggi. Gunakan dasar kondisi lokasi Anda; foto tidak menentukan C." },
  paved: { ...txdot, ranges: [{ label: "Aspal", low: .85, high: .95 }, { label: "Beton", low: .90, high: .95 }], note: "Batas bawah berbeda menurut bahan: aspal lebih rendah daripada beton. Tidak ada pemetaan kondisi detail di dalam masing-masing rentang." },
  soil: { ...txdot, ranges: [
    { label: "Pasir/lempung berpasir · lereng 0–3%", low: .15, high: .20 },
    { label: "Pasir/lempung berpasir · lereng 3–5%", low: .20, high: .25 },
    { label: "Tanah hitam/loess · lereng 0–3%", low: .18, high: .25 },
    { label: "Tanah hitam/loess · lereng 3–5%", low: .25, high: .30 },
  ], note: "Contoh lahan belum dikembangkan, bukan patokan universal tanah terbuka. Tabel memberi rentang lebih tinggi pada lereng yang lebih curam. Jenis tanah dan lereng perlu diketahui di lokasi; TIRTA tidak menebaknya." },
  vegetation: { ...txdot, ranges: [
    { label: "Rumput · tanah berpasir, datar 2%", low: .05, high: .10 },
    { label: "Rumput · tanah berat, datar 2%", low: .13, high: .17 },
    { label: "Rumput · tanah berat, lereng 2–7%", low: .18, high: .22 },
    { label: "Rumput · tanah berat, curam 7%", low: .25, high: .35 },
    { label: "Taman", low: .10, high: .25 },
  ], note: "Rumput berpasir/datar memiliki patokan lebih rendah; tanah berat/curam lebih tinggi. Vegetasi lain perlu referensi yang sesuai, bukan otomatis rentang rumput." },
  porous: { ranges: [], source: "USGS · Selbig & Buer (2018) · SIR 2018-5037", url: "https://pubs.usgs.gov/publication/sir20185037", note: "Tidak ada satu angka universal. Studi membandingkan tiga perkerasan berpori; sedimen dan pemeliharaan memengaruhi kinerja. Gunakan pengukuran atau referensi sistem yang sesuai, bukan tampilan porinya." },
};
export const coefficientMethodNote = "Patokan TxDOT berasal dari metode debit puncak. Penggunaannya untuk volume kejadian TIRTA adalah asumsi pra-perencanaan Anda, bukan kalibrasi lokasi. Nilai tengah hanya titik tengah aritmetis, bukan angka terpisah dari sumber.";
export function coefficientPicks(range: CoefficientRange) {
  return [ { label: "Rendah", value: range.low }, { label: "Tengah rentang", value: Number(((range.low + range.high) / 2).toFixed(4)) }, { label: "Tinggi", value: range.high } ];
}
export function outsideGuidance(surface: Surface | null, value: number) {
  const ranges = surface ? coefficientGuidance[surface].ranges : [];
  return ranges.length > 0 && !ranges.some(r => value >= r.low && value <= r.high);
}
export function coefficientChoiceSource(surface: Surface, range: CoefficientRange, value: number) {
  return `Pilihan pengguna C=${value}; ${range.label}, rentang ${range.low}–${range.high}. ${coefficientGuidance[surface].source}; ${coefficientGuidance[surface].url}. Asumsi pra-perencanaan volume kejadian, bukan kalibrasi lokasi.`;
}
