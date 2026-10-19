import { ZodError } from "zod";

export function planningError(cause: unknown): string {
  if (cause instanceof ZodError) return "Data belum dapat disimpan. Periksa pilihan zona, angka, dan sumbernya. Isian Anda tetap ada.";
  return cause instanceof Error ? cause.message : "Perubahan belum tersimpan. Periksa isian Anda, lalu coba lagi.";
}
