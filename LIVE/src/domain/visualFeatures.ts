import { z } from "zod";
import { surfaceSchema, type Surface } from "./model";

const fraction = z.number().finite().min(0).max(1);
export const visualFeaturesSchema = z.strictObject({
  version: z.literal("tirta-visual-features/1"),
  opaquePixels: z.number().int().min(0).max(65536),
  darkPixels: z.number().int().nonnegative(), midPixels: z.number().int().nonnegative(), brightPixels: z.number().int().nonnegative(),
  meanBrightness: fraction, meanSaturation: fraction,
  edgeDensity: fraction, localVariation: fraction,
  repetition: z.strictObject({ lag: z.number().int().min(2).max(16), similarity: fraction }).nullable(),
}).refine(f => f.darkPixels + f.midPixels + f.brightPixels === f.opaquePixels, "Histogram tidak cocok dengan piksel opak.");
export type VisualFeatures = z.infer<typeof visualFeaturesSchema>;

/** Normalized visual measurements at the analysis resolution, never physical roughness. */
export function observeVisualFeatures(rgba: Uint8ClampedArray, width: number, height: number): VisualFeatures {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256 || rgba.length !== width * height * 4) throw new Error("Ukuran piksel tidak valid.");
  const luma = new Float64Array(width * height), valid = new Uint8Array(width * height);
  let opaquePixels = 0, darkPixels = 0, midPixels = 0, brightPixels = 0, brightness = 0, saturation = 0;
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4; if (rgba[offset + 3]! < 128) continue;
    valid[i] = 1; opaquePixels++;
    const r = rgba[offset]!, g = rgba[offset + 1]!, b = rgba[offset + 2]!;
    const y = (.2126 * r + .7152 * g + .0722 * b) / 255;
    luma[i] = y; brightness += y;
    const max = Math.max(r, g, b); saturation += max ? (max - Math.min(r, g, b)) / max : 0;
    if (y < .25) darkPixels++; else if (y > .75) brightPixels++; else midPixels++;
  }
  let pairs = 0, edges = 0, variation = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x; if (!valid[i]) continue;
    for (const j of [x + 1 < width ? i + 1 : -1, y + 1 < height ? i + width : -1]) {
      if (j < 0 || !valid[j]) continue;
      const delta = Math.abs(luma[i]! - luma[j]!); pairs++; variation += delta; if (delta >= .12) edges++;
    }
  }
  let repetition: VisualFeatures["repetition"] = null;
  // A flat photograph is not repeating texture. Compare nonzero contrast over several pixel offsets.
  if (pairs && edges / pairs >= .05 && opaquePixels >= 256) {
    for (let lag = 2; lag <= Math.min(16, Math.floor(Math.min(width, height) / 3)); lag++) {
      let diff = 0, count = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x; if (!valid[i]) continue;
        for (const j of [x + lag < width ? i + lag : -1, y + lag < height ? i + lag * width : -1]) {
          if (j < 0 || !valid[j]) continue;
          diff += Math.abs(luma[i]! - luma[j]!); count++;
        }
      }
      if (count >= 128) {
        const similarity = 1 - diff / count;
        if (similarity >= .95 && (!repetition || similarity > repetition.similarity)) repetition = { lag, similarity };
      }
    }
  }
  return { version: "tirta-visual-features/1", opaquePixels, darkPixels, midPixels, brightPixels, meanBrightness: opaquePixels ? brightness / opaquePixels : 0, meanSaturation: opaquePixels ? saturation / opaquePixels : 0, edgeDensity: pairs ? edges / pairs : 0, localVariation: pairs ? variation / pairs : 0, repetition };
}

type ColourCounts = { green: number; brown: number; neutral: number; other: number; transparent: number };
export type VisualCandidate = { surface: Surface; level: "Indikasi kuat" | "Indikasi sedang" | "Indikasi lemah" | "Belum cukup bukti visual"; reason: string };
export function visualCandidates(counts: ColourCounts, features?: VisualFeatures): VisualCandidate[] {
  const total = counts.green + counts.brown + counts.neutral + counts.other;
  const poorLight = !features || !total || (features.darkPixels + features.brightPixels) / total > .9;
  const candidate = (surface: Surface): VisualCandidate & { order: number } => {
    const share = total ? (surface === "vegetation" ? counts.green : surface === "soil" ? counts.brown : counts.neutral) / total : 0;
    const natural = surface === "vegetation" || surface === "soil";
    const order = !total ? 0 : natural ? share >= .7 && !poorLight ? 3 : share >= .35 ? 2 : share >= .15 ? 1 : 0 : share >= .4 ? 1 : 0;
    const reason = natural ? `${surface === "vegetation" ? "Hijau" : "Cokelat"} mencakup ${Math.round(share * 100)}% piksel opak; bisa juga cat atau pengaruh cahaya.`
      : surface === "porous" ? features?.repetition ? "Ada pengulangan kontras; paving berpori maupun kedap dapat berpola sama. Pori dan infiltrasi belum terbukti." : "Foto tidak membuktikan pori terbuka atau lapisan bawah." : surface === "roof" ? "Warna netral/garis dapat muncul pada atap maupun perkerasan; posisi dan bahan perlu verifikasi." : "Bidang netral dapat menyerupai beton/aspal, atap atau bahan lain; kekedapan tidak terukur.";
    return { surface, order, level: (["Belum cukup bukti visual", "Indikasi lemah", "Indikasi sedang", "Indikasi kuat"] as const)[order]!, reason };
  };
  return surfaceSchema.options.map(candidate).sort((a, b) => b.order - a.order).map(({ order: _order, ...c }) => { void _order; return c; });
}
