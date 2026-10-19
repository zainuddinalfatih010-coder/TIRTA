import type { ReactNode } from "react";
import type { Surface } from "../domain/model";
import { coefficientGuidance, coefficientMethodNote } from "../domain/coefficientGuidance";
import "./calculation-source.css";
import { ScientificReference } from './ScientificReference';

export function SourceDisclosure({ children, kind }: { children: ReactNode; kind: string }) {
  return <details className="calculation-source" data-method={kind}>
    <summary>Sumber & dasar perhitungan</summary>
    <div className="calculation-source-content">{children}</div>
  </details>;
}

export function CoefficientSource({ surface }: { surface: Surface | null }) {
  if (!surface) return null;
  const guidance = coefficientGuidance[surface];
  return <SourceDisclosure key={surface} kind="coefficient">
    <p>Patokan ini membantu memilih angka koefisien untuk jenis permukaan. Pilih nilai berdasarkan bahan dan kondisi yang Anda ketahui; TIRTA tidak memilihkannya otomatis.</p>
    <details className="calculation-source-technical">
      <summary>Detail ilmiah & referensi</summary>
      <p><a href={guidance.url} target="_blank" rel="noreferrer">{guidance.source}</a></p>
      <p>{guidance.note}</p>
      {guidance.ranges.length > 0 && <p>Koefisien Rational Method TxDOT terutama untuk debit puncak. {coefficientMethodNote}</p>}
    </details>
  </SourceDisclosure>;
}

export function CalculationSource({ method }: { method: "rainfall" | "runoff" | "ledger" | "pareto" }) {
  return <SourceDisclosure kind={method}>
    {method === "rainfall" || method === "runoff" ? <>
      <p><strong>Cara hitung singkat.</strong> Air hujan dihitung dari luas × kedalaman hujan. Bagian yang menjadi limpasan mengikuti koefisien permukaan.</p>
      <p>Volume hujan = A × P / 1.000. Volume limpasan zona = volume hujan zona × C.</p>
      {method === "runoff" && <p>Limpasan persil adalah jumlah limpasan semua zona. Bagian non-limpasan bukan otomatis berarti air terinfiltrasi.</p>}
      <details className="calculation-source-technical">
        <summary>Detail ilmiah & referensi</summary>
        <p><strong>Hubungan volume hujan–limpasan · volumetric runoff coefficient.</strong></p>
        <p>A adalah luas dalam m², P kedalaman hujan dalam mm, dan C koefisien limpasan tanpa satuan. Pembagian 1.000 mengubah mm menjadi meter; hasil volume dalam m³.</p>
        <p><a href="https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=901X0A00.TXT" target="_blank" rel="noreferrer">US EPA · Stormwater Best Management Practice Design Guide, Volume 1 (2004), Appendix B, hlm. B-19 & glosarium</a> menjelaskan hubungan kedalaman hujan, koefisien volumetrik, dan limpasan. Rujukan ini mendasari hubungan volume; TIRTA tidak mengambil koefisien otomatis dari panduan tersebut.</p>
        <p>Ini estimasi volume kejadian, bukan rumus debit puncak Rational Method. C tetap input dengan sumber/asumsi pengguna, bukan kalibrasi lokasi.</p>
        {method === "runoff" && <p>Kontribusi zona = limpasan zona / limpasan persil × 100%; jika total nol, tidak ada kontribusi limpasan.</p>}
      </details>
    </> : method === "ledger" ? <>
      <p><strong>Metode: neraca volume / conservation ledger.</strong></p>
      <p>Limpasan awal = ditampung + dimanfaatkan + diinfiltrasikan + sisa limpasan. Volume tertangani dibatasi oleh limpasan yang tersedia dari zona sumber yang dipilih dan kapasitas intervensi pada kejadian ini. Air yang sama tidak dihitung dua kali.</p>
      <p>Ini neraca volume, bukan rumus empiris kinerja intervensi. Kapasitas, pemanfaatan, dan infiltrasi memakai data beserta sumbernya. Penurunan limpasan = limpasan awal − sisa limpasan; hasil harus menjaga keseimbangan volume.</p>
      <details className="calculation-source-technical"><summary>Urutan penanganan & batas model</summary><p>Konversi berpori lokal diperhitungkan dahulu; intervensi lain mengikuti urutan rencana dan mengambil air tersisa dari target secara berurutan. Urutan ini dapat memengaruhi pembagian air; bukan simulasi jalur atau debit fisik. Urutan tiap paket tercantum di tinjauan kelayakan dan unduhan rencana.</p><ScientificReference claimId="CLAIM-CONNECTION" label="Dasar hubungan sumber air" /></details>
    </> : <>
      <p><strong>Metode: Pareto dominance / multi-objective filtering.</strong></p>
      <p>Hanya kandidat yang memenuhi batas diperiksa. Kandidat tersisih jika kandidat lain memiliki sisa limpasan, biaya, dan lahan yang semuanya lebih kecil atau sama, dengan setidaknya satu lebih kecil. Perbandingan memakai angka sebelum pembulatan.</p>
      <p>Hasil terbatas pada opsi yang Anda masukkan. Penyaringan tidak memakai skor berbobot atau menentukan satu pilihan terbaik untuk semua tujuan.</p>
      <ScientificReference claimId="CLAIM-PARETO" label="Bukti & batas penerapan Pareto" />
    </>}
  </SourceDisclosure>;
}
