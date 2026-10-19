import type { ProjectV2 } from "./projectV2";

/** Owner product scope, not a competition rule or numerical solver limit. */
export const MAX_PARCEL_AREA_M2 = 200;
export function parcelScopeIssue(p: ProjectV2): string | null {
  const area = p.parameters.find((v) => v.id === p.parcel?.area.id)?.value;
  return area != null && area > MAX_PARCEL_AREA_M2
    ? "Luas persil melebihi batas TIRTA 200 m². Koreksi luas atau modelkan bagian lahan yang sesuai; data lama tetap tersimpan."
    : null;
}
export function enforceAreaEdit(before: ProjectV2, after: ProjectV2): void {
  const previous = before.parameters.find(
    (v) => v.id === before.parcel?.area.id,
  )?.value;
  const next = after.parameters.find(
    (v) => v.id === after.parcel?.area.id,
  )?.value;
  if (next != null && next > MAX_PARCEL_AREA_M2 && next !== previous)
    throw new Error(
      "Maksimum luas persil 200 m². Angka belum diterapkan; periksa luas atau pilih bagian lahan yang akan dimodelkan.",
    );
  const sum = (p: ProjectV2) =>
    p.zones.reduce(
      (n, z) => n + (p.parameters.find((v) => v.id === z.area.id)?.value ?? 0),
      0,
    );
  if (sum(after) > MAX_PARCEL_AREA_M2 && sum(after) > sum(before))
    throw new Error(
      "Jumlah luas zona melampaui 200 m². Periksa luas zona sebelum menerapkan perubahan.",
    );
}
