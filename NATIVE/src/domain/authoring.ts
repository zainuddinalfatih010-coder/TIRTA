import { invalidateRoofRouting } from './roofRouting';
import { deriveEditedAreas } from "./scaledAreas";
import { unreviewedReceivingSite } from './siteEvidence';
import type { Point, Surface } from "./model";
import { projectV2Schema, type ProjectV2 } from "./projectV2";
import { confirmClassification } from "./classification";
import { validatePolygon, containsPolygon, polygonsOverlap } from "./geometry";
import type { ParameterV2, ReferenceV2 } from "./v2-primitives";
import {enforceAreaEdit} from './parcelPolicy';
export type Shape =
  NonNullable<ProjectV2["parcel"]> | ProjectV2["zones"][number];
export type Edit = (p: ProjectV2) => ProjectV2;
export const reference = (p: ParameterV2): ReferenceV2 => ({
  id: p.id,
  unit: p.unit,
  evidence: p.evidence,
});
export const shapeById = (p: ProjectV2, id: string): Shape | undefined =>
  p.parcel?.id === id ? p.parcel : p.zones.find((z) => z.id === id);
export function checked(p: ProjectV2): ProjectV2 {
  const r = projectV2Schema.safeParse(p);
  if (!r.success)
    throw new Error(
      r.error.issues
        .map((i) => i.message)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 3)
        .join(" "),
    );
  return r.data;
}
const unknown = (id: string, unit: ParameterV2["unit"]): ParameterV2 => ({
  id,
  unit,
  revision: 1,
  value: null,
  evidence: "UNKNOWN",
  source: "",
  note: "",
  applicability: "",
});
const errors: Record<string, string> = {
  vertex_count: "Gunakan 3–100 titik.",
  drawing_coordinate:
    "Koordinat sketsa harus berhingga, maksimum ±1.000.000 dengan paling banyak tiga desimal.",
  duplicate_vertex: "Ada titik yang sama. Pindahkan atau hapus salah satunya.",
  degenerate_polygon: "Bentuk terlalu kecil atau titik-titiknya segaris.",
  self_touch: "Sisi bentuk menyentuh atau berbalik pada dirinya sendiri.",
  self_intersection: "Sisi bentuk berpotongan. Pindahkan titik yang bersilang.",
};
export function geometryError(
  p: ProjectV2,
  id: string | null,
  polygon: Point[],
  parcel = false,
): string | null {
  const bad = validatePolygon(polygon);
  if (bad.length) return errors[bad[0]!] ?? "Bentuk tidak valid.";
  if (parcel) {
    const outside = p.zones.filter((z) => !containsPolygon(polygon, z.polygon));
    return outside.length
      ? `Batas baru akan mengeluarkan zona: ${outside.map((z) => z.name).join(", ")}.`
      : null;
  }
  if (!p.parcel) return "Buat batas persil terlebih dahulu.";
  if (!containsPolygon(p.parcel.polygon, polygon))
    return "Zona melewati batas persil. Pindahkan titik ke dalam batas.";
  const overlap = p.zones.find(
    (z) => z.id !== id && polygonsOverlap(polygon, z.polygon),
  );
  return overlap
    ? `Zona bertumpang tindih dengan ${overlap.name}. Batas boleh bersentuhan, isi zona tidak boleh bertumpuk.`
    : null;
}
export function addShape(
  p: ProjectV2,
  id: string,
  polygon: Point[],
  parcel = false,
): ProjectV2 {
  const error = geometryError(p, null, polygon, parcel);
  if (error) throw new Error(error);
  if (parcel && p.parcel)
    throw new Error("Persil sudah ada. Edit batas yang ada.");
  const area = unknown(`${id}-area`, "m2"),
    coefficient = unknown(`${id}-c`, "ratio");
  const shared = {
    id,
    polygon,
    area: reference(area),
    areaMethod: { kind: "direct" as const },
  };
  return checked(deriveEditedAreas(structuredClone({
    ...p,
    parameters: [...p.parameters, area, ...(parcel ? [] : [coefficient])],
    parcel: parcel ? { ...shared, geometryContext: "schematic" } : p.parcel,
    zones: parcel
      ? p.zones
      : [
          ...p.zones,
          {
            ...shared,
            name: `Zona ${p.zones.length + 1}`,
            revision: 1,
            surface: null,
            classificationRecordId: null,
            coefficient: reference(coefficient),
          },
        ],
  })));
}
export function reshape(p: ProjectV2, id: string, polygon: Point[]): ProjectV2 {
  const shape = shapeById(p, id);
  if (!shape) throw new Error("Objek sudah tidak ada.");
  const parcel = p.parcel?.id === id,
    error = geometryError(p, id, polygon, parcel);
  if (error) throw new Error(error);
  return checked(invalidateRoofRouting(deriveEditedAreas(structuredClone({
    ...p,
    parcel: parcel ? { ...p.parcel!, polygon } : p.parcel,
    zones: p.zones.map((z) =>
      z.id === id ? { ...z, polygon, revision: z.revision + 1 } : z,
    ),
  })), id, polygon));
}
export function dependencies(p: ProjectV2, id: string): string[] {
  const shape = shapeById(p, id),
    ids = new Set(
      shape
        ? [
            shape.area.id,
            ...("coefficient" in shape ? [shape.coefficient.id] : []),
            ...(shape.areaMethod.kind === "measured-rectangle"
              ? [shape.areaMethod.length.id, shape.areaMethod.width.id]
              : []),
          ]
        : [],
    );
  return [
    ...p.components
      .filter((c) => c.targets.includes(id))
      .map(
        (c) =>
          `Target intervensi ${c.name} akan hilang; pilih target baru nanti.`,
      ),
    ...[
      ...p.manualPlans,
      ...(p.selectedPlan ? [p.selectedPlan.definition] : []),
    ]
      .filter((plan) => plan.components.some((c) => c.targets.includes(id)))
      .map(
        (plan) =>
          `Rencana ${plan.name} perlu ditinjau kembali. Snapshot lama tetap disimpan.`,
      ),
    ...p.scenarios
      .filter((s) => s.overrides.some((o) => ids.has(o.baseParameterId)))
      .map(
        (s) =>
          `Uji asumsi zona pada ${s.name} akan dilepas; catatan angkanya tetap disimpan.`,
      ),
  ];
}
export function deleteZone(p: ProjectV2, id: string): ProjectV2 {
  const z = p.zones.find((z) => z.id === id);
  if (!z) throw new Error("Zona tidak ditemukan.");
  const ids = new Set([
    z.area.id,
    z.coefficient.id,
    ...(z.areaMethod.kind === "measured-rectangle"
      ? [z.areaMethod.length.id, z.areaMethod.width.id]
      : []),
  ]);
  // Keep numeric/history/plan records; remove only overrides whose owning shape has gone.
  const remaining = new Set(
    p.zones
      .filter((x) => x.id !== id)
      .flatMap((x) => [
        x.area.id,
        x.coefficient.id,
        ...(x.areaMethod.kind === "measured-rectangle"
          ? [x.areaMethod.length.id, x.areaMethod.width.id]
          : []),
      ]),
  );
  if (p.parcel) {
    remaining.add(p.parcel.area.id);
    if (p.parcel.areaMethod.kind === "measured-rectangle") {
      remaining.add(p.parcel.areaMethod.length.id);
      remaining.add(p.parcel.areaMethod.width.id);
    }
  }
  return checked({
    ...p,
    zones: p.zones.filter((x) => x.id !== id),
    components: p.components.map(c => c.treatment?.installationZoneId === id ? { ...c, revision: c.revision + 1, treatment: { ...c.treatment, installationZoneId: null } } : c),
    ...(p.science ? { science: { ...p.science,
      interventions: Object.fromEntries(Object.entries(p.science.interventions).map(([key, e]) => {
        const c = p.components.find(c => c.id === key);
        const review = c?.family !== 'storage' && (c?.treatment?.installationZoneId === id || e.soilReference?.zoneId === id) ? unreviewedReceivingSite(e) : e;
        return [key, { ...review, ...(e.overflow.kind === 'zone' && e.overflow.id === id ? { overflow: { kind: 'unknown' as const } } : {}), ...(e.soilReference?.zoneId === id ? { soilReference: undefined } : {}) }];
      })),
      surfaces: Object.fromEntries(Object.entries(p.science.surfaces).filter(([key]) => key !== id).map(([key,c])=>[key,c.roof.routing?.destinationZoneId===id?{...c,roof:{...c.roof,routing:{...c.roof.routing,destinationZoneId:null,status:'unchecked' as const}}}:c])),
      connections: p.science.connections.filter(c => c.sourceZoneId !== id).map(c => c.destination.kind === 'zone' && c.destination.id === id ? { ...c, destination: { kind: 'unknown' as const }, origin: 'unknown' as const, source: '' } : c),
    } } : {}),
    scenarios: p.scenarios.map((s) => ({
      ...s,
      overrides: s.overrides.filter(
        (o) => !ids.has(o.baseParameterId) || remaining.has(o.baseParameterId),
      ),
    })),
  });
}
export function deleteParcel(p: ProjectV2): ProjectV2 {
  if (!p.parcel) throw new Error("Persil tidak ditemukan.");
  const next = p.zones.reduce((current, zone) => deleteZone(current, zone.id), p);
  const ids = new Set([p.parcel.area.id, ...(p.parcel.areaMethod.kind === "measured-rectangle" ? [p.parcel.areaMethod.length.id, p.parcel.areaMethod.width.id] : [])]);
  return checked({ ...next, parcel: null, drawingScale: undefined, scenarios: next.scenarios.map(s => ({ ...s, overrides: s.overrides.filter(o => !ids.has(o.baseParameterId)) })) });
}
export type ValueInput = {
  value: number | null;
  evidence: ParameterV2["evidence"];
  source: string;
  note: string;
};
export function sharedDataUsers(p: ProjectV2, id: string): string[] {
  const shape = shapeById(p, id);
  if (!shape) return [];
  const ids = new Set([
    shape.area.id,
    ...("coefficient" in shape ? [shape.coefficient.id] : []),
    ...(shape.areaMethod.kind === "measured-rectangle"
      ? [shape.areaMethod.length.id, shape.areaMethod.width.id]
      : []),
  ]);
  const uses = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(uses);
    const o = value as Record<string, unknown>;
    return Object.keys(o).length === 3 &&
      "unit" in o &&
      "evidence" in o &&
      typeof o.id === "string"
      ? ids.has(o.id)
      : Object.values(o).some(uses);
  };
  return [
    ...(p.parcel && p.parcel.id !== id && uses(p.parcel)
      ? ["Batas persil"]
      : []),
    ...p.zones.filter((z) => z.id !== id && uses(z)).map((z) => z.name),
    ...p.components.filter(uses).map((c) => c.name),
    ...p.installationSites.filter(uses).map((s) => s.name),
    ...(uses(p.constraints) ? ["Batas budget/lahan"] : []),
    ...p.scenarios
      .filter(
        (s) =>
          s.overrides.some((o) => ids.has(o.baseParameterId)) ||
          uses(s.rainfall),
      )
      .map((s) => `Skenario ${s.name}`),
  ];
}
export type ShapeInput = {
  name: string;
  surface: Surface | null;
  area: ValueInput;
  coefficient: ValueInput;
  method: "direct" | "measured-rectangle";
  length: ValueInput;
  width: ValueInput;
};
export function updateShapeData(
  p: ProjectV2,
  id: string,
  input: ShapeInput,
  newId: () => string,
): ProjectV2 {
  const next = structuredClone(p),
    shape = shapeById(next, id);
  if (!shape) throw new Error("Objek sudah tidak ada.");
  let shapeDataChanged = false;
  function write(r: ReferenceV2, data: ValueInput): ReferenceV2 {
    if (data.value !== null) {
      if (!data.source.trim())
        throw new Error(
          "Isi sumber atau alasan untuk setiap angka yang diketahui.",
        );
      if (["UNKNOWN", "ASSIST_SUGGESTION"].includes(data.evidence))
        throw new Error("Pilih status sumber angka yang terkonfirmasi.");
    }
    const old = next.parameters.find((v) => v.id === r.id);
    if (!old) throw new Error("Sumber angka tidak ditemukan.");
    const evidence = data.value === null ? ("UNKNOWN" as const) : data.evidence;
    const changed = old.value !== data.value || old.evidence !== evidence || old.source !== data.source || old.note !== data.note;
    if (changed) shapeDataChanged = true;
    const value = {
      ...old,
      ...data,
      evidence,
      revision: changed ? old.revision + 1 : old.revision,
    };
    next.parameters = next.parameters.map((v) => (v.id === r.id ? value : v));
    // Shared current references retain one numeric truth; historical plans remain immutable.
    function replace(value: unknown): void {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(replace);
        return;
      }
      const o = value as Record<string, unknown>;
      if (
        Object.keys(o).length === 3 &&
        o.id === r.id &&
        "unit" in o &&
        "evidence" in o
      )
        o.evidence = data.value === null ? "UNKNOWN" : data.evidence;
      else Object.values(o).forEach(replace);
    }
    const { manualPlans: _plans, selectedPlan: _selected, ...current } = next;
    void _plans;
    void _selected;
    replace(current);
    return reference(value);
  }
  if (input.method === "direct") {
    if (input.area.value !== null && input.area.value <= 0)
      throw new Error(
        "Luas harus lebih dari nol, atau kosong bila belum diketahui.",
      );
    if (shape.areaMethod.kind !== "direct") shapeDataChanged = true;
    shape.areaMethod = { kind: "direct" };
    shape.area = write(shape.area, input.area);
  } else {
    if (
      [input.length, input.width].some((v) => v.value !== null && v.value <= 0)
    )
      throw new Error(
        "Panjang dan lebar harus positif, atau kosong bila belum diketahui.",
      );
    const refs =
      shape.areaMethod.kind === "measured-rectangle"
        ? shape.areaMethod
        : (() => {
            const l = unknown(newId(), "m"),
              w = unknown(newId(), "m");
            next.parameters.push(l, w);
            return { length: reference(l), width: reference(w) };
          })();
    const length = write(refs.length, input.length),
      width = write(refs.width, input.width);
    const area =
      input.length.value !== null && input.width.value !== null
        ? input.length.value * input.width.value
        : null;
    if (
      area !== null &&
      (!Number.isFinite(area) ||
        input.length.value! <= 0 ||
        input.width.value! <= 0)
    )
      throw new Error(
        "Panjang dan lebar harus positif dan menghasilkan luas yang berhingga.",
      );
    if (shape.areaMethod.kind !== "measured-rectangle" || shape.areaMethod.length.id !== length.id || shape.areaMethod.width.id !== width.id) shapeDataChanged = true;
    shape.areaMethod = { kind: "measured-rectangle", length, width };
    shape.area = write(shape.area, {
      value: area,
      evidence: area === null ? "UNKNOWN" : "SOURCE_DERIVED",
      source:
        area === null
          ? ""
          : `Luas = panjang × lebar. Sumber: ${length.id}, ${width.id}.`,
      note: "Dimensi dinyatakan pengguna; tidak mengalibrasi sketsa.",
    });
  }
  if ("coefficient" in shape) {
    if (shape.name !== input.name) shapeDataChanged = true;
    shape.name = input.name;
    const classChanged = shape.surface !== null && input.surface !== shape.surface;
    shape.coefficient = write(
      shape.coefficient,
      classChanged
        ? { value: null, evidence: "UNKNOWN", source: "", note: "" }
        : input.coefficient,
    );
    const classificationChanged = input.surface !== null && (input.surface !== shape.surface || shape.classificationRecordId === null);
    if (classificationChanged) shape.revision++;
    else if (shapeDataChanged) shape.revision++;
    enforceAreaEdit(p,next);
    if (classificationChanged && input.surface !== null)
      return confirmClassification(
        checked(next),
        { projectId: next.id, zoneId: id, zoneRevision: shape.revision },
        input.surface,
        null,
        newId(),
      );
    if (input.surface === null) {
      const leavingRoof = shape.surface === "roof";
      shape.surface = null;
      shape.classificationRecordId = null;
      if (leavingRoof) return checked(invalidateRoofRouting(next, id));
    }
  }
  enforceAreaEdit(p,next);
  return checked(next);
}
