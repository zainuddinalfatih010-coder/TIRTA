import type { ProjectV2 } from "./projectV2";
import type { Surface } from "./model";
import { imageRecommendation } from "./imageObservations";
import type { VisualFeatures } from "./visualFeatures";
import { productionBaseline } from "./productionBaseline";
import { planningParameterValue } from "./planningEngine";

export function imageContext(p: ProjectV2, zoneId: string, scenarioId: string, surface: Surface | null, features?: VisualFeatures) {
  const zone = p.zones.find(z => z.id === zoneId);
  const result = imageRecommendation(surface);
  if (!zone) return { ...result, facts: [] };
  const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);
  if (surface === "porous" && (zone.surface !== "porous" || !zone.classificationRecordId)) {
    result.status = "Perlu verifikasi";
    result.reason = "Jika Anda mengonfirmasi permukaan ini sudah berpori, perlakuan berpori tambahan tidak boleh mendapat kredit ganda. Pilihan kelas pada hasil foto belum mengubah model sampai Anda mengonfirmasinya.";
  }
  const facts: string[] = [];
  const base = productionBaseline(p, scenarioId);
  const balance = base.ok ? base.value.zones.find(z => z.id === zoneId) : null;
  for (const [label, ref] of [["Luas zona dari model", zone.area], ["C tercatat", zone.coefficient]] as const) {
    try { const value = planningParameterValue(p.parameters, ref, ref.unit, label); facts.push(`${label}: ${fmt(value)}${ref.unit === "m2" ? " m²; bukan hasil foto" : ""}.`); }
    catch { facts.push(`${label}: belum diketahui atau belum terverifikasi.`); }
  }
  if (base.ok && balance) {
    const share = base.value.runoffM3 > 0 ? balance.runoffM3 / base.value.runoffM3 : null;
    facts.push(`Hujan aktif ${fmt(base.value.rainfallMm)} mm → zona ini ${fmt(balance.runoffM3)} m³ limpasan${share === null ? "" : ` (${fmt(share * 100)}% dari persil)`}.`);
    if (surface === "roof" && zone.surface === "roof" && zone.classificationRecordId && balance.runoffM3 > 0) {
      result.reason = `Atap terkonfirmasi menyumbang ${fmt(balance.runoffM3)} m³ limpasan pada hujan ini dengan C ${fmt(balance.coefficient)}. Tangki dapat dipertimbangkan untuk air tersebut; sambungan, tampungan tersedia, biaya dan ruang perlu dinyatakan. Tidak ada intervensi yang diaktifkan otomatis.`;
    }
  } else facts.push("Kontribusi limpasan belum tersedia; lengkapi model dan hujan bersumber.");
  if (features) facts.push(features.opaquePixels ? `Foto: ${features.localVariation < .04 ? "variasi kontras lokal rendah" : "variasi kontras lokal terlihat"}${features.repetition ? "; ada pengulangan kontras" : ""}. Ini tampilan piksel, bukan kekasaran fisik atau kemampuan resapan.` : "Tidak ada piksel opak untuk ditinjau.");
  return { ...result, facts };
}
