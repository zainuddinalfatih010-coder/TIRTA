import { routingIssues } from './sourceRouting';
import { z } from "zod";
import { emptyScience, scientificRevisionSchema } from "./scientificContract";
import { imageObservationSchema } from "./imageObservations";
import { surfaceSchema } from "./model";
import {
  areaFields,
  classificationSchema,
  idSchema,
  nameSchema,
  noteSchema,
  parameterV2Schema,
  polygonSchema,
  referenceV2Schema,
  revisionSchema,
} from "./v2-primitives";
import {
  componentSchema,
  optionGroupSchema,
  planSchema,
} from "./intervention-contract";
import { validatePolygon, containsPolygon, polygonsOverlap, polygonArea } from "./geometry";

export const guideTopics = [
  "about",
  "workflow",
  "projects",
  "studio",
  "surfaces",
  "area",
  "dimensions",
  "coefficient",
  "provenance",
  "unknown",
  "surface-assist",
  "rainfall",
  "scenarios",
  "sensitivity",
  "baseline",
  "contributions",
  "interventions",
  "tank",
  "infiltration",
  "rain-garden",
  "porous",
  "event-capacity",
  "reuse",
  "constraints",
  "alternatives",
  "pareto",
  "compare",
  "decision",
  "save",
  "backup",
  "offline",
  "limitations",
  "glossary",
  "method",
] as const;
export const preferencesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contextualGuidance: z.boolean(),
  lastGuideTopic: z.enum(guideTopics).nullable(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
const scenarioSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  revision: revisionSchema,
  rainfall: referenceV2Schema,
  eventWindowNote: noteSchema,
  overrides: z
    .array(
      z.strictObject({
        baseParameterId: idSchema,
        replacement: referenceV2Schema,
      }),
    )
    .max(5000),
});
const attachmentSchema = z
  .strictObject({
    id: idSchema,
    purpose: z.literal("underlay"),
    mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    source: noteSchema,
  })
  .refine(
    (a) => a.width * a.height <= 16000000,
    "Gambar melebihi 16 megapiksel.",
  );
export const projectV2Shape = z.strictObject({
  schemaVersion: z.literal(2),
  science: scientificRevisionSchema.optional(),
  id: idSchema,
  name: nameSchema,
  mode: z.enum(["real", "demo"]),
  revision: revisionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  importedFrom: z
    .strictObject({ id: idSchema, revision: revisionSchema })
    .nullable(),
  drawingScale: z.strictObject({
    metersPerUnit: z.literal(1),
    source: z.string().trim().min(1).max(2000),
    initialLength: z.number().finite().positive(),
    initialWidth: z.number().finite().positive(),
  }).optional(),
  parcel: z
    .strictObject({
      id: idSchema,
      polygon: polygonSchema,
      ...areaFields,
      geometryContext: z.literal("schematic"),
    })
    .nullable(),
  parameters: z.array(parameterV2Schema).max(5000),
  zones: z
    .array(
      z.strictObject({
        id: idSchema,
        name: nameSchema,
        revision: revisionSchema,
        polygon: polygonSchema,
        geometryContext: z.literal("schematic-area").optional(),
        surface: surfaceSchema.nullable(),
        surfaceContext: noteSchema.optional(),
        poreType: z.enum(["unknown", "natural", "manufactured"]).optional(),
        classificationRecordId: idSchema.nullable(),
        ...areaFields,
        coefficient: referenceV2Schema,
      }),
    )
    .max(200),
  scenarios: z.array(scenarioSchema).max(30),
  installationSites: z
    .array(
      z.strictObject({
        id: idSchema,
        name: nameSchema,
        availableArea: referenceV2Schema,
        suitability: noteSchema,
        evidence: z.enum([
          "USER_INPUT",
          "MEASURED",
          "SOURCE_DERIVED",
          "ASSUMPTION",
          "DEMO",
          "UNKNOWN",
        ]),
        polygon: polygonSchema.nullable(),
      }),
    )
    .max(200),
  components: z.array(componentSchema).max(1000),
  optionGroups: z.array(optionGroupSchema).max(1000),
  manualPlans: z.array(planSchema).max(1000),
  selectedPlan: z
    .strictObject({
      definition: planSchema,
      decisionNote: noteSchema,
      reviewedInputFingerprint: z.string().max(200000).nullable(),
    })
    .nullable(),
  classificationRecords: z.array(classificationSchema).max(10000),
  imageObservations: z.array(imageObservationSchema).max(20).optional(),
  attachments: z.array(attachmentSchema).max(10),
  underlay: z
    .strictObject({
      attachmentId: idSchema,
      x: z.number().finite(),
      y: z.number().finite(),
      scale: z.number().positive().finite(),
      opacity: z.number().min(0).max(1),
      locked: z.boolean(),
      context: z.literal("schematic"),
    })
    .nullable(),
  constraints: z.strictObject({
    budget: referenceV2Schema,
    usableArea: referenceV2Schema,
    minInstallations: z.number().int().nonnegative(),
    requiredScenarioIds: z.array(idSchema).max(30),
  }),
  planningGoal: z.strictObject({
    note: noteSchema,
    viewFocus: z.enum(["all", "cost", "area", "residual"]),
    target: z.strictObject({
      metric: z.enum(["reduction-percent", "residual-m3"]),
      value: z.number().finite().nonnegative(),
      source: z.string().trim().min(1).max(2000),
    }).refine(t => t.metric !== "reduction-percent" || t.value <= 100, "Target pengurangan harus 0–100%.").optional(),
  }),
  shortlist: z.array(idSchema).max(1000),
});
export type ProjectV2 = z.infer<typeof projectV2Shape>;

export const projectV2Schema = projectV2Shape.superRefine((p, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  for (const message of routingIssues(p,{allowSemanticRoofStale:true})) issue(["science"], message);
  const unique = (items: { id: string }[], path: string) => {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      issue([path], "Identitas ganda.");
  };
  for (const key of [
    "parameters",
    "zones",
    "scenarios",
    "installationSites",
    "components",
    "optionGroups",
    "manualPlans",
    "classificationRecords",
    "attachments",
  ] as const)
    unique(p[key], key);
  if (
    p.mode === "real" &&
    (p.parameters.some((x) => x.evidence === "DEMO") ||
      p.classificationRecords.some((x) => x.origin === "demo") ||
      p.installationSites.some((x) => x.evidence === "DEMO"))
  )
    issue(["mode"], "Data DEMO tidak boleh masuk proyek riil.");
  const parameters = new Map(p.parameters.map((v) => [v.id, v]));
  // All numeric references are validated, including history/snapshots. Deleted object targets remain draft blockers.
  function refs(
    value: unknown,
    path: (string | number)[],
    lookup = parameters,
  ) {
    if (Array.isArray(value))
      return value.forEach((v, i) => refs(v, [...path, i], lookup));
    if (!value || typeof value !== "object") return;
    const r = referenceV2Schema.safeParse(value);
    if (r.success) {
      const v = lookup.get(r.data.id);
      if (!v || v.unit !== r.data.unit || v.evidence !== r.data.evidence)
        issue(path, "Sumber, satuan, atau status referensi tidak cocok.");
      return;
    }
    for (const [key, v] of Object.entries(value))
      refs(v, [...path, key], lookup);
  }
  const { manualPlans, selectedPlan, ...current } = p;
  refs(current, []);
  for (const plan of [
    ...manualPlans,
    ...(selectedPlan ? [selectedPlan.definition] : []),
  ]) {
    unique(plan.parameters, `plans.${plan.id}.parameters`);
    refs(
      plan,
      ["plans", plan.id],
      new Map(plan.parameters.map((v) => [v.id, v])),
    );
    if (p.mode === "real" && plan.parameters.some((v) => v.evidence === "DEMO"))
      issue(
        ["plans", plan.id],
        "Data DEMO tidak boleh masuk riwayat proyek riil.",
      );
  }
  const unit = (
    r: z.infer<typeof referenceV2Schema>,
    expected: string,
    path: string,
  ) => {
    if (r.unit !== expected) issue([path], `Satuan harus ${expected}.`);
  };
  unit(p.constraints.budget, "IDR", "constraints.budget");
  unit(p.constraints.usableArea, "m2", "constraints.usableArea");
  const shapes = [
    ...(p.parcel ? [{ ...p.parcel, name: "Persil" }] : []),
    ...p.zones,
  ];
  for (const shape of shapes) {
    if (p.drawingScale && shape.geometryContext !== "schematic-area") {
      const area = parameters.get(shape.area.id);
      const expected = polygonArea(shape.polygon);
      if (!area || area.value === null || Math.abs(area.value - expected) > 1e-9 || area.evidence !== "SOURCE_DERIVED" || !area.source.trim())
        issue([shape.id, "area"], "Luas harus sama dengan polygon pada skala dimensi yang dinyatakan.");
      if (shape.id === p.parcel?.id && expected > 200)
        issue([shape.id, "area"], "Maksimum luas persil 200 m².");
    }
    for (const error of validatePolygon(shape.polygon))
      issue([shape.id, "polygon"], error);
    unit(shape.area, "m2", `${shape.id}.area`);
    if (shape.areaMethod.kind === "measured-rectangle") {
      const { length, width } = shape.areaMethod;
      unit(length, "m", shape.id);
      unit(width, "m", shape.id);
      const a = parameters.get(shape.area.id),
        l = parameters.get(length.id),
        w = parameters.get(width.id);
      if (l && w && a) {
        if (l.value !== null && w.value !== null) {
          const value = l.value * w.value;
          if (
            !Number.isFinite(value) ||
            value <= 0 ||
            a.value !== value ||
            a.evidence !== "SOURCE_DERIVED" ||
            !a.source.trim() ||
            !l.source.trim() ||
            !w.source.trim() ||
            [l, w].some((v) => v.evidence === "ASSIST_SUGGESTION")
          )
            issue(
              [shape.id, "area"],
              "Luas persegi panjang harus berasal dari panjang × lebar dengan sumber.",
            );
        } else if (a.value !== null)
          issue(
            [shape.id, "area"],
            "Dimensi UNKNOWN tidak boleh menghasilkan luas.",
          );
      }
    }
  }
  if (p.drawingScale && (!p.parcel || p.drawingScale.initialLength * p.drawingScale.initialWidth > 200))
    issue(["drawingScale"], "Skala memerlukan batas dan dimensi awal maksimum 200 m².");
  if (!p.parcel && p.zones.length)
    issue(["parcel"], "Zona memerlukan batas persil.");
  for (let i = 0; i < p.zones.length; i++) {
    const zone = p.zones[i]!;
    unit(zone.coefficient, "ratio", zone.id);
    if (p.parcel && !containsPolygon(p.parcel.polygon, zone.polygon))
      issue(["zones", i, "polygon"], "Zona berada di luar batas persil.");
    for (let j = 0; j < i; j++)
      if (polygonsOverlap(zone.polygon, p.zones[j]!.polygon))
        issue(["zones", i, "polygon"], "Zona saling tumpang tindih.");
    if (zone.classificationRecordId !== null) {
      const r = p.classificationRecords.find(
        (c) => c.id === zone.classificationRecordId,
      );
      if (
        !r ||
        r.zoneId !== zone.id ||
        (r.origin === "demo" ? r.class : r.confirmedClass) !== zone.surface
      )
        issue(
          ["zones", i, "classificationRecordId"],
          "Kelas dan catatan konfirmasi tidak cocok.",
        );
    }
  }
  for (const image of p.imageObservations ?? []) {
    if (image.state !== "rejected") {
      const record = p.classificationRecords.find(r => r.id === image.classificationRecordId);
      if (!record || record.zoneId !== image.zoneId || (record.origin === "demo" ? record.class : record.confirmedClass) !== image.confirmedClass)
        issue(["imageObservations", image.id], "Hasil citra dan riwayat konfirmasi tidak cocok.");
    }
  }
  for (const r of p.classificationRecords)
    if (r.origin !== "demo" && r.predecessorId !== null) {
      const prev = p.classificationRecords.find(
        (x) => x.id === r.predecessorId,
      );
      if (prev && (prev.zoneId !== r.zoneId || prev.revision >= r.revision))
        issue(["classificationRecords", r.id], "Urutan riwayat tidak valid.");
    }
  for (const s of p.scenarios) {
    unit(s.rainfall, "mm", s.id);
    const allowed = new Set([
      s.rainfall.id,
      ...shapes.flatMap((x) => [
        x.area.id,
        ...(x.areaMethod.kind === "measured-rectangle"
          ? [x.areaMethod.length.id, x.areaMethod.width.id]
          : []),
      ]),
      ...p.zones.map((z) => z.coefficient.id),
    ]);
    const protectedIds = new Set([
      p.constraints.budget.id,
      p.constraints.usableArea.id,
      ...p.installationSites.map((x) => x.availableArea.id),
      ...p.components.flatMap((c) => [c.totalCost.id, c.occupiedArea.id]),
    ]);
    for (const c of p.components) {
      const perf = c.performanceByScenario[s.id];
      if (perf)
        for (const [key, v] of Object.entries(perf)) {
          const r = referenceV2Schema.safeParse(v);
          if (r.success) allowed.add(r.data.id);
          if (key === "reuse" && v && typeof v === "object" && "demand" in v) {
            const d = referenceV2Schema.safeParse(v.demand);
            if (d.success) allowed.add(d.data.id);
          }
        }
    }
    if (
      new Set(s.overrides.map((o) => o.baseParameterId)).size !==
      s.overrides.length
    )
      issue(["scenarios", s.id], "Override ganda.");
    for (const o of s.overrides) {
      if (p.drawingScale && shapes.some(shape => shape.area.id === o.baseParameterId))
        issue(["scenarios", s.id], "Luas berskala mengikuti polygon; tidak dapat diganti oleh skenario hujan.");
      const base = parameters.get(o.baseParameterId);
      if (!base || base.unit !== o.replacement.unit)
        issue(
          ["scenarios", s.id],
          "Override tidak cocok dengan parameter dasar.",
        );
      if (
        !allowed.has(o.baseParameterId) ||
        protectedIds.has(o.baseParameterId)
      )
        issue(
          ["scenarios", s.id],
          "Uji asumsi hanya untuk hujan, luas/dimensi, C, atau kapasitas kejadian terkait.",
        );
    }
  }
  for (const s of p.installationSites) {
    unit(s.availableArea, "m2", s.id);
    if (s.polygon && validatePolygon(s.polygon).length)
      issue(["installationSites", s.id], "Geometri lokasi tidak valid.");
  }
  const variants = [
    ...p.components,
    ...p.manualPlans.flatMap((x) => x.components),
    ...(p.selectedPlan?.definition.components ?? []),
  ];
  for (const c of variants) {
    unit(c.totalCost, "IDR", c.id);
    unit(c.occupiedArea, "m2", c.id);
    if (new Set(c.targets).size !== c.targets.length)
      issue(["components", c.id], "Target ganda.");
    if (
      c.family === "permeable" &&
      (c.targets.length > 1 ||
        JSON.stringify(c.treatedArea) !== JSON.stringify(c.occupiedArea))
    )
      issue(
        ["components", c.id],
        "Perawatan berpori memiliki satu target dan satu sumber luas.",
      );
    if (c.placement?.footprint && validatePolygon(c.placement.footprint).length)
      issue(["components", c.id], "Footprint skematis tidak valid.");
    for (const perf of Object.values(c.performanceByScenario))
      for (const [key, value] of Object.entries(perf)) {
        if (key === "applicability") continue;
        if (key === "reuse") {
          if (
            value !== null &&
            typeof value === "object" &&
            "demand" in value
          ) {
            const r = referenceV2Schema.safeParse(value.demand);
            if (r.success) unit(r.data, "m3/event", c.id);
          }
        } else {
          const r = referenceV2Schema.safeParse(value);
          if (r.success) unit(r.data, "m3/event", c.id);
        }
      }
  }
  const owners = new Map<string, string>();
  for (const g of p.optionGroups) {
    unique(g.choices, `optionGroups.${g.id}.choices`);
    for (const c of g.choices) {
      if (new Set(c.componentIds).size !== c.componentIds.length)
        issue(
          ["optionGroups", g.id],
          "Satu instance tidak boleh dipasang dua kali.",
        );
      for (const id of c.componentIds) {
        const other = owners.get(id);
        if (other && other !== g.id)
          issue(["optionGroups", g.id], "Instance dibagi antar grup.");
        owners.set(id, g.id);
      }
    }
  }
  for (const plan of [
    ...p.manualPlans,
    ...(p.selectedPlan ? [p.selectedPlan.definition] : []),
  ]) {
    unique(plan.components, `plans.${plan.id}`);
    if (
      plan.priority.length !== plan.components.length ||
      new Set(plan.priority).size !== plan.priority.length ||
      plan.priority.some((id) => !plan.components.some((c) => c.id === id))
    )
      issue(
        ["plans", plan.id],
        "Prioritas harus menyebut setiap instance tepat sekali.",
      );
  }
  if (
    p.underlay &&
    !p.attachments.some((a) => a.id === p.underlay!.attachmentId)
  )
    issue(["underlay"], "Referensi gambar tidak ditemukan.");
  if (p.underlay) {
    const image = p.attachments.find((a) => a.id === p.underlay!.attachmentId);
    if (
      image &&
      [
        image.width * p.underlay.scale,
        image.height * p.underlay.scale,
        p.underlay.x + image.width * p.underlay.scale,
        p.underlay.y + image.height * p.underlay.scale,
      ].some((n) => !Number.isFinite(n))
    )
      issue(
        ["underlay"],
        "Transformasi gambar melampaui rentang sketsa yang berhingga.",
      );
  }
});

export function createProjectV2(
  id: string,
  name: string,
  now: string,
): ProjectV2 {
  const unknown = (key: string, unit: "IDR" | "m2") => ({
    id: key,
    revision: 1,
    value: null,
    unit,
    evidence: "UNKNOWN" as const,
    source: "",
    note: "",
    applicability: "",
  });
  const budget = unknown("budget", "IDR"),
    area = unknown("usable-area", "m2");
  const testRain = (id: string, depth: number) => ({
    id: `${id}-depth`,
    revision: 1,
    value: depth,
    unit: "mm" as const,
    evidence: "ASSUMPTION" as const,
    source: "Skenario uji bawaan TIRTA; bukan data hujan lokasi atau prediksi cuaca.",
    note: "Boleh diubah atau dihapus pengguna.",
    applicability: "Perbandingan awal pra-perencanaan.",
  });
  const rain50 = testRain("r50", 50), rain100 = testRain("r100", 100);
  return projectV2Schema.parse({
    schemaVersion: 2,
    science: emptyScience(),
    id,
    name,
    mode: "real",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    importedFrom: null,
    parcel: null,
    parameters: [budget, area, rain50, rain100],
    zones: [],
    scenarios: [
      { id: "r50", name: "Hujan 50 mm", revision: 1, rainfall: { id: rain50.id, unit: rain50.unit, evidence: rain50.evidence }, eventWindowNote: "Skenario uji bawaan; bukan hujan terukur.", overrides: [] },
      { id: "r100", name: "Hujan 100 mm", revision: 1, rainfall: { id: rain100.id, unit: rain100.unit, evidence: rain100.evidence }, eventWindowNote: "Skenario uji bawaan; bukan hujan terukur.", overrides: [] },
    ],
    installationSites: [],
    components: [],
    optionGroups: [],
    manualPlans: [],
    selectedPlan: null,
    classificationRecords: [],
    attachments: [],
    underlay: null,
    constraints: {
      budget: { id: budget.id, unit: budget.unit, evidence: budget.evidence },
      usableArea: { id: area.id, unit: area.unit, evidence: area.evidence },
      minInstallations: 0,
      requiredScenarioIds: [],
    },
    planningGoal: { note: "", viewFocus: "all" },
    shortlist: [],
  });
}
