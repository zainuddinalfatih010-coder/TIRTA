import { calculateBaseline, type Baseline } from "./baseline";
import { parameterSchema, projectSchema, type Outcome } from "./model";
import { projectV2Schema, type ProjectV2 } from "./projectV2";
import type { ParameterV2, ReferenceV2 } from "./v2-primitives";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function baselineRefs(p: ProjectV2, scenarioId: string): ReferenceV2[] {
  const s = p.scenarios.find((x) => x.id === scenarioId);
  return [
    ...(s ? [s.rainfall] : []),
    ...[...(p.parcel ? [p.parcel] : []), ...p.zones].flatMap((x) => [
      x.area,
      ...("coefficient" in x ? [x.coefficient] : []),
      ...(x.areaMethod.kind === "measured-rectangle"
        ? [x.areaMethod.length, x.areaMethod.width]
        : []),
    ]),
  ];
}
export function baselineIdentity(p: ProjectV2, scenarioId: string): string {
  const refs = baselineRefs(p, scenarioId).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
    ids = new Set(refs.map((r) => r.id)),
    s = p.scenarios.find((x) => x.id === scenarioId);
  const overrides =
    s?.overrides
      .filter((o) => ids.has(o.baseParameterId))
      .sort((a, b) =>
        a.baseParameterId < b.baseParameterId
          ? -1
          : a.baseParameterId > b.baseParameterId
            ? 1
            : 0,
      ) ?? [];
  overrides.forEach((o) => ids.add(o.replacement.id));
  return JSON.stringify(
    canonical({
      engine: "baseline-v1/adapter-v2",
      projectId: p.id,
      mode: p.mode,
      scenarioId,
      rainfall: s?.rainfall ?? null,
      parcelArea: p.parcel?.area ?? null,
      refs,
      overrides,
      zones: p.zones
        .map((z) => ({
          id: z.id,
          surface: z.surface,
          area: z.area,
          coefficient: z.coefficient,
          areaMethod: z.areaMethod,
          classification:
            p.classificationRecords.find(
              (r) => r.id === z.classificationRecordId,
            ) ?? null,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      parameters: p.parameters
        .filter((v) => ids.has(v.id))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      parcelAreaMethod: p.parcel?.areaMethod ?? null,
    }),
  );
}

export function baselineV2(
  input: unknown,
  scenarioId: string,
): Outcome<Baseline> {
  const parsed = projectV2Schema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        code: "invalid_project",
        path: i.path.join("."),
        message: i.message,
      })),
    };
  const p = parsed.data,
    s = p.scenarios.find((x) => x.id === scenarioId);
  const fail = (
    code: string,
    path: string,
    message: string,
  ): Outcome<never> => ({ ok: false, issues: [{ code, path, message }] });
  if (!s) return fail("missing_scenario", "scenarios", "Pilih skenario hujan.");
  for (const z of p.zones)
    if (z.classificationRecordId === null)
      return fail(
        "unconfirmed_class",
        `zones.${z.id}.surface`,
        "Label lama atau kosong; konfirmasi jenis permukaan terlebih dahulu.",
      );
  const allowed = new Set(baselineRefs(p, scenarioId).map((r) => r.id));
  const parameters = new Map(p.parameters.map((v) => [v.id, v]));
  const overrides = new Map(
    s.overrides.map((o) => [o.baseParameterId, o.replacement]),
  );
  const effective = (r: ReferenceV2): ParameterV2 | undefined =>
    parameters.get((overrides.get(r.id) ?? r).id);
  const ref = (r: ReferenceV2): ReferenceV2 => overrides.get(r.id) ?? r;
  const derived: ParameterV2[] = [];
  const shape = (
    x: NonNullable<ProjectV2["parcel"]> | ProjectV2["zones"][number],
  ) => {
    if (x.areaMethod.kind === "direct") return ref(x.area);
    const l = effective(x.areaMethod.length),
      w = effective(x.areaMethod.width);
    const base = parameters.get(x.area.id)!;
    if (
      overrides.has(x.areaMethod.length.id) ||
      overrides.has(x.areaMethod.width.id)
    ) {
      const value =
        l?.value !== null && w?.value !== null && l && w
          ? l.value * w.value
          : null;
      derived.push({
        ...base,
        value,
        evidence: value === null ? "UNKNOWN" : "SOURCE_DERIVED",
        source:
          value === null
            ? ""
            : `A = L × W; referensi panjang: ${l!.id}; lebar: ${w!.id}. Sumber lengkap dipertahankan pada parameter asal.`,
      });
    }
    const result = derived.find((v) => v.id === x.area.id);
    return result
      ? { id: result.id, unit: result.unit, evidence: result.evidence }
      : x.area;
  };
  for (const x of [...(p.parcel ? [p.parcel] : []), ...p.zones])
    if (x.areaMethod.kind === "measured-rectangle" && overrides.has(x.area.id))
      return fail(
        "conflicting_area_override",
        `scenarios.${s.id}.overrides`,
        "Uji dimensi atau gunakan metode luas langsung, bukan keduanya.",
      );
  for (const o of s.overrides)
    if (allowed.has(o.baseParameterId)) {
      const value = parameters.get(o.replacement.id)!;
      if (
        value.evidence !== "ASSUMPTION" &&
        value.evidence !== "UNKNOWN" &&
        !(p.mode === "demo" && value.evidence === "DEMO")
      )
        return fail(
          "override_evidence",
          `scenarios.${s.id}.overrides`,
          "Uji asumsi harus memiliki sumber dan status asumsi eksplisit.",
        );
    }
  for (const x of [...(p.parcel ? [p.parcel] : []), ...p.zones])
    if (x.areaMethod.kind === "measured-rectangle") {
      const l = effective(x.areaMethod.length),
        w = effective(x.areaMethod.width);
      for (const d of [l, w])
        if (
          d &&
          d.value !== null &&
          (!d.source.trim() ||
            d.evidence === "ASSIST_SUGGESTION" ||
            d.value <= 0)
        )
          return fail(
            "invalid_dimension",
            `${x.id}.areaMethod`,
            "Dimensi positif memerlukan sumber terkonfirmasi.",
          );
      if (
        l?.value !== null &&
        w?.value !== null &&
        l &&
        w &&
        !Number.isFinite(l.value * w.value)
      )
        return fail(
          "overflow",
          `${x.id}.areaMethod`,
          "Angka dimensi terlalu besar. Periksa satuannya.",
        );
    }
  const parcel = p.parcel
    ? { polygon: p.parcel.polygon, area: shape(p.parcel) }
    : null;
  const zones = p.zones.map((z) => ({
    id: z.id,
    name: z.name.slice(0, 100),
    polygon: z.polygon,
    surface: z.surface,
    area: shape(z),
    coefficient: ref(z.coefficient),
  }));
  for (const d of derived) parameters.set(d.id, d);
  const requiredIds = new Set([
    parcel?.area.id,
    s.rainfall.id,
    ref(s.rainfall).id,
    ...zones.flatMap((z) => [z.area.id, z.coefficient.id]),
  ]);
  const legacyParameters = [...parameters.values()]
    .filter((v) => requiredIds.has(v.id))
    .map(({ revision: _revision, applicability: _applicability, ...v }) => {
      void _revision;
      void _applicability;
      return parameterSchema.parse(v);
    });
  // The existing engine remains the only implementation of the event arithmetic.
  const legacy = projectSchema.parse({
    schemaVersion: 1,
    id: p.id,
    name: p.name,
    mode: p.mode,
    parcel,
    zones,
    scenarios: [
      { id: s.id, name: s.name.slice(0, 100), rainfall: ref(s.rainfall) },
    ],
    parameters: legacyParameters,
  });
  const result = calculateBaseline(legacy, s.id);
  return result.ok
    ? {
        ok: true,
        value: { ...result.value, inputKey: baselineIdentity(p, scenarioId) },
      }
    : result;
}
