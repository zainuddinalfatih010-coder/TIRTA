import { projectV2Schema, type ProjectV2 } from "./projectV2";
import { planningInputsReady, planningParameterValue, planningFingerprint, evaluatePlan } from "./planningEngine";
import { productionBaseline } from "./productionBaseline";
import { parcelScopeIssue } from "./parcelPolicy";
import type { ReferenceV2 } from "./v2-primitives";

export const workflowStages = ["project", "studio", "rain", "interventions", "alternatives", "compare", "impact"] as const;
export type WorkflowStage = typeof workflowStages[number];
export type ReadinessIssue = { stage: WorkflowStage; field: string; message: string; zoneId?: string; componentId?: string };
export type SearchReadiness = { evaluated: number; rows: readonly unknown[]; issues: string[] };
export function workflowReadiness(p: ProjectV2 | null, scenarioId: string, search: SearchReadiness) {
  const entry: Record<WorkflowStage, ReadinessIssue[]> = { project: [], studio: [], rain: [], interventions: [], alternatives: [], compare: [], impact: [] };
  if (!p) {
    for (const stage of workflowStages.slice(1)) entry[stage] = [{ stage: "project", field: "projectName", message: "Buat atau buka proyek terlebih dahulu." }];
    return entry;
  }
  const studio: ReadinessIssue[] = [];
  const add = (field: string, message: string, zoneId?: string) => studio.push({ stage: "studio", field, message, zoneId });
  const parsed = projectV2Schema.safeParse(p);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const z = issue.path[0] === "zones" && typeof issue.path[1] === "number" ? p.zones[issue.path[1]] : undefined;
    add("geometry", `${z?.name ? `${z.name} — ` : ""}${issue.message}`, z?.id);
  }
  const parameter = (ref: ReferenceV2, unit: ReferenceV2["unit"], label: string, field: string, zoneId?: string) => {
    try { return planningParameterValue(p.parameters, ref, unit, label); }
    catch (e) { const record = p.parameters.find(v => v.id === ref.id); add(field === "coefficient" && record?.value != null && !record.source.trim() ? "coefficientSource" : field, e instanceof Error ? e.message : `${label} belum lengkap.`, zoneId); return null; }
  };
  if (!p.parcel) add("dimensions", "Buat batas persil dari ukuran yang Anda ketahui.");
  const scope = parcelScopeIssue(p); if (scope) add("geometry", scope);
  const area = p.parcel ? parameter(p.parcel.area, "m2", "Luas persil", "geometry") : null;
  if (area !== null && area <= 0) add("geometry", "Luas persil harus lebih dari nol.");
  if (!p.zones.length) add("geometry", "Tambahkan zona hingga seluruh persil terwakili.");
  let zoneArea = 0, allArea = true;
  for (const z of p.zones) {
    if (!z.surface || !z.classificationRecordId) add("surface", `${z.name} — jenis permukaan belum dikonfirmasi.`, z.id);
    const c = parameter(z.coefficient, "ratio", `${z.name} — koefisien`, "coefficient", z.id);
    if (c !== null && c > 1) add("coefficient", `${z.name} — koefisien harus 0–1.`, z.id);
    const a = parameter(z.area, "m2", `${z.name} — luas`, "geometry", z.id);
    if (a === null) allArea = false; else { zoneArea += a; if (a <= 0) add("geometry", `${z.name} — luas harus lebih dari nol.`, z.id); }
  }
  if (allArea && area !== null && p.zones.length && Math.abs(zoneArea - area) > 1e-9 * Math.max(1, area)) {
    const number = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 9 });
    const schematic = p.zones.some(z => 'geometryContext' in z && z.geometryContext === 'schematic-area');
    add("coverage", zoneArea < area
      ? `${number(area - zoneArea)} m² belum menjadi zona (${number(zoneArea)} dari ${number(area)} m² terwakili). ${schematic ? 'Tambahkan area sederhana atau koreksi luas area yang sudah ada; luas tidak dilengkapi otomatis.' : 'Gambarkan zona pada bagian yang diarsir; isian zona yang sudah ada tetap tersimpan.'}`
      : `Luas zona ${number(zoneArea)} m² melebihi persil ${number(area)} m². Periksa bentuk dan sumber luas; data tidak dikoreksi otomatis.`);
  }
  entry.rain = studio;
  if (studio.length) {
    for (const stage of ["interventions", "alternatives", "compare", "impact"] as const) entry[stage] = studio;
    return entry;
  }
  const baseline = productionBaseline(p, scenarioId);
  if (!baseline.ok) {
    const issues = baseline.issues.map(i => ({ stage: "rain" as const, field: i.path.endsWith(".rainfall") && i.code === "missing_source" ? "rainfallSource" : "rainfall", message: i.path.endsWith(".rainfall")
      ? i.code === "unknown" ? "Kedalaman hujan belum diterapkan. Isi nilai dan sumbernya, lalu tekan Terapkan hujan & hitung ulang." : `Hujan — ${i.message}`
      : i.message }));
    for (const stage of ["interventions", "alternatives", "compare", "impact"] as const) entry[stage] = issues;
    return entry;
  }
  // A chosen definition is evaluated independently from the editable option registry.
  // Unfinished/disabled alternatives cannot invalidate an otherwise supported chosen plan.
  // Baseline and fingerprint gates above/below still apply to every chosen definition.
  if (!p.selectedPlan) entry.impact = [{ stage: "alternatives", field: "alternatives", message: "Pilih satu rencana setelah meninjau trade-off." }];
  else if (p.selectedPlan.reviewedInputFingerprint !== planningFingerprint(p)) entry.impact = [{ stage: "alternatives", field: "alternatives", message: "Data berubah sejak rencana dipilih. Tinjau alternatif dan pilih kembali rencana." }];
  else {
    entry.impact = [...new Set([scenarioId, ...p.constraints.requiredScenarioIds])].flatMap(sid => {
      const result = evaluatePlan(p, p.selectedPlan!.definition, sid);
      if (result.ok) return [];
      const rainMissing = !productionBaseline(p, sid).ok;
      return result.issues.map(i => ({ stage: rainMissing ? "rain" as const : "interventions" as const, field: rainMissing ? "rainfall" : "constraints", message: i.message }));
    });
  }
  const planning = planningInputsReady(p, scenarioId);
  if (!planning.ok) {
    const issues = planning.issues.map(i => {
      return { stage: "interventions" as const, field: i.field ?? "constraints", message: i.message, componentId: i.componentId };
    });
    for (const stage of ["alternatives", "compare"] as const) entry[stage] = issues;
    return entry;
  }
  // An explicitly empty option space remains viewable as 0 declared combinations.
  if (!search.rows.length || !search.evaluated) entry.compare = [{ stage: "alternatives", field: "alternatives", message: "Belum ada alternatif layak untuk dibandingkan. Tinjau pilihan dan batas rencana." }];
  return entry;
}
export function forwardIssues(current: WorkflowStage, next: WorkflowStage, readiness: ReturnType<typeof workflowReadiness>) {
  return workflowStages.indexOf(next) > workflowStages.indexOf(current) ? readiness[next] : [];
}
