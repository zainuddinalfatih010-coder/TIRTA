import type { ProjectV2 } from "./projectV2";
import type { ReferenceV2 } from "./v2-primitives";
import { resolveParameter } from "./validation";
import { type Project, unitSchema } from "./model";
import {parcelScopeIssue} from './parcelPolicy';

export type MissingInput = {
  objectId: string;
  field: "area" | "coefficient" | "surface" | "zones" | "total";
  message: string;
};
export function parcelReadiness(p: ProjectV2): {
  issues: MissingInput[];
  total: number | null;
  parcelArea: number | null;
} {
  const issues: MissingInput[] = [];
  const scope = parcelScopeIssue(p);
  if(scope) issues.push({objectId:p.parcel?.id??'',field:'area',message:scope});
  if (!p.parcel)
    return {
      issues: [
        {
          objectId: "",
          field: "area",
          message: "Gambar batas persil untuk mulai.",
        },
      ],
      total: null,
      parcelArea: null,
    };
  // Resolve the same source/unit/evidence rules as the retained baseline; no synthetic rainfall is needed.
  const lookup: Project = {
    schemaVersion: 1,
    id: p.id,
    name: p.name,
    mode: p.mode,
    parcel: null,
    zones: [],
    scenarios: [],
    parameters: p.parameters
      .filter((v) => v.unit !== "m")
      .map(({ revision, applicability, ...v }) => {
        void revision;
        void applicability;
        return { ...v, unit: unitSchema.parse(v.unit) };
      }),
  };
  const value = (r: ReferenceV2, id: string, field: "area" | "coefficient") => {
    const result = resolveParameter(
      lookup,
      { ...r, unit: unitSchema.parse(r.unit) },
      field === "area" ? "m2" : "ratio",
      id,
    );
    if (!result.ok) {
      issues.push({ objectId: id, field, message: result.issues[0]!.message });
      return null;
    }
    if (field === "area" && result.value.value <= 0) {
      issues.push({
        objectId: id,
        field,
        message: "Luas harus lebih dari nol.",
      });
      return null;
    }
    return result.value.value;
  };
  const parcelArea = value(p.parcel.area, p.parcel.id, "area");
  let sum = 0,
    known = true;
  if (!p.zones.length)
    issues.push({
      objectId: p.parcel.id,
      field: "zones",
      message: "Bagi lahan menjadi zona permukaan.",
    });
  for (const z of p.zones) {
    const a = value(z.area, z.id, "area");
    value(z.coefficient, z.id, "coefficient");
    if (a === null) known = false;
    else sum += a;
    if (z.surface === null || z.classificationRecordId === null)
      issues.push({
        objectId: z.id,
        field: "surface",
        message: "Pilih dan konfirmasi jenis permukaan.",
      });
  }
  if (!Number.isFinite(sum)) {
    known = false;
    issues.push({
      objectId: p.parcel.id,
      field: "total",
      message:
        "Jumlah luas terlalu besar untuk dihitung. Periksa kembali angka dan satuan luas zona.",
    });
  }
  if (
    known &&
    parcelArea !== null &&
    Math.abs(sum - parcelArea) > 1e-9 * Math.max(1, parcelArea)
  )
    issues.push({
      objectId: p.parcel.id,
      field: "total",
      message: `Jumlah luas zona ${sum.toLocaleString("id-ID")} m² belum sama dengan luas persil ${parcelArea.toLocaleString("id-ID")} m². ${p.drawingScale ? "Lengkapi pembagian zona hingga seluruh persil tercakup." : "Ukuran gambar tidak mengubah luas input."}`,
    });
  return { issues, total: known ? sum : null, parcelArea };
}
