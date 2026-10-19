import { visualFeaturesSchema } from "./visualFeatures";
import { z } from "zod";
import { surfaceSchema, type Surface } from "./model";

export const IMAGE_ALGORITHM = "tirta-colour-regions/2" as const;
export const regionNames = ["green", "brown", "neutral", "other", "transparent"] as const;
export const regionLabels = { green: "Hijau dominan", brown: "Cokelat dominan", neutral: "Warna netral", other: "Warna lain", transparent: "Transparan / diabaikan" };
export const maskColors = [[64, 143, 102], [189, 129, 65], [104, 140, 174], [164, 145, 176], [240, 240, 240]] as const;
const countsSchema = z.strictObject(Object.fromEntries(regionNames.map(n => [n, z.number().int().nonnegative()])) as Record<typeof regionNames[number], z.ZodNumber>);
const png = z.string().max(400000).regex(/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/);
export const imageObservationSchema = z.strictObject({
  id: z.string().min(1), zoneId: z.string().min(1), zoneRevision: z.number().int().positive(),
  algorithm: z.enum(["tirta-colour-regions/1", IMAGE_ALGORITHM]), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  originalWidth: z.number().int().positive(), originalHeight: z.number().int().positive(),
  width: z.number().int().min(1).max(256), height: z.number().int().min(1).max(256),
  features: visualFeaturesSchema.optional(),
  counts: countsSchema, suggestedClass: surfaceSchema.nullable(),
  preview: png, mask: png, source: z.string().trim().min(1).max(2000),
  state: z.enum(["confirmed", "corrected", "rejected"]), confirmedClass: surfaceSchema.nullable(),
  classificationRecordId: z.string().nullable(),
}).superRefine((v, ctx) => {
  const total = regionNames.reduce((n, key) => n + v.counts[key], 0);
  if (total !== v.width * v.height || v.originalWidth * v.originalHeight > 16000000)
    ctx.addIssue({ code: "custom", message: "Jumlah piksel atau ukuran citra tidak cocok." });
  if (v.features && v.features.opaquePixels !== total - v.counts.transparent) ctx.addIssue({ code: "custom", message: "Jumlah piksel fitur visual tidak cocok." });
  if (v.suggestedClass !== suggestedSurface(v.counts))
    ctx.addIssue({ code: "custom", message: "Saran tidak cocok dengan hasil algoritma warna." });
  if (v.state === "rejected" ? v.confirmedClass !== null || v.classificationRecordId !== null : v.confirmedClass === null || !v.classificationRecordId)
    ctx.addIssue({ code: "custom", message: "Konfirmasi citra tidak konsisten." });
});
export type ImageObservation = z.infer<typeof imageObservationSchema>;
export type RegionCounts = z.infer<typeof countsSchema>;

export function suggestedSurface(c: RegionCounts): Surface | null {
  const valid = c.green + c.brown + c.neutral + c.other;
  if (!valid) return null;
  if (c.green / valid >= .35 && c.green > c.brown) return "vegetation";
  if (c.brown / valid >= .35 && c.brown > c.green) return "soil";
  return null;
}

/** Colour bins are observations, not a trained semantic classifier or confidence. */
export function analysePixels(rgba: Uint8ClampedArray, width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || rgba.length !== width * height * 4)
    throw new Error("Ukuran piksel tidak valid.");
  const counts: RegionCounts = { green: 0, brown: 0, neutral: 0, other: 0, transparent: 0 };
  const mask = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!, a = rgba[i + 3]!;
    const key = a < 128 ? "transparent" : g > 50 && g > r * 1.12 && g > b * 1.08 ? "green" : r > 50 && r > g * 1.08 && g > b * 1.1 ? "brown" : Math.max(r, g, b) - Math.min(r, g, b) <= 25 ? "neutral" : "other";
    counts[key]++;
    const color = maskColors[regionNames.indexOf(key)];
    mask.set([...color!, 255], i);
  }
  return { counts, mask, suggestedClass: suggestedSurface(counts) };
}

export function imageRecommendation(surface: Surface | null) {
  if (surface === "roof") return {
    status: "Direkomendasikan untuk dipertimbangkan",
    reason: "Jika Anda mengonfirmasi atap, pertimbangkan penampungan melalui tangki. Sambungan air, kapasitas, biaya dan ruang tetap harus dinyatakan; foto tidak membuktikan kelayakan pemasangan.",
  };
  if (surface === "porous") return {
    status: "Tidak direkomendasikan berdasarkan data saat ini",
    reason: "Perlakuan berpori tambahan pada zona yang sudah dikonfirmasi berpori tidak boleh mendapat kredit ganda. Intervensi lain dapat ditinjau terpisah.",
  };
  return {
    status: "Perlu verifikasi",
    reason: surface === "vegetation" || surface === "soil"
      ? "Warna ini dapat menjadi petunjuk lokasi yang perlu diperiksa untuk resapan atau taman hujan. Cat, bayangan dan pencahayaan dapat menipu. Foto tidak membuktikan jenis permukaan, ruang tersedia atau kemampuan infiltrasi tanah."
      : "Warna saja belum cukup untuk membedakan atap, perkerasan dan permukaan berpori. Pilih kelas berdasarkan pengetahuan lokasi; verifikasi tanah dan ruang sebelum mempertimbangkan intervensi.",
  };
}
