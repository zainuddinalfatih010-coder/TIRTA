import type { ProjectV2 } from "./projectV2";
import { evaluatePlan, type Alternative, type Plan } from "./planningEngine";
import { interventionUnknowns } from "./interventionSuitability";
import { productionBaseline } from "./productionBaseline";
import type { ComponentVariant } from "./intervention-contract";
import { interventionReview } from "./interventionReview";
import { siteGuidance } from './siteGuidance';
import { planImplementationChecks } from './planClosure';

export const waterUses = {
  unknown: "Belum diputuskan",
  irrigation: "Penyiraman tanaman",
  cleaning: "Pembersihan nonkonsumsi",
  toilet: "Toilet / sanitasi nonkonsumsi",
  temporary: "Tampungan sementara dengan pengosongan terencana",
} as const;

export function assessPackage(project: ProjectV2, plan: Plan, activeScenario: string) {
  const scenarioIds = [...new Set([activeScenario, ...project.constraints.requiredScenarioIds])];
  const target = project.planningGoal.target;
  const scenarios = scenarioIds.map(id => {
    const outcome = evaluatePlan(project, plan, id);
    const name = project.scenarios.find(s => s.id === id)?.name ?? id;
    if (!outcome.ok) return { id, name, outcome, targetMet: null, extraVolume: null };
    const b = outcome.value;
    if (!target || (target.metric === "reduction-percent" && b.baseline === 0)) return { id, name, outcome, targetMet: null, extraVolume: null };
    const allowedResidual = target.metric === "residual-m3" ? target.value : b.baseline * (1 - target.value / 100);
    const extraVolume = Math.max(0, b.residual - allowedResidual);
    return { id, name, outcome, targetMet: b.residual <= allowedResidual + 1e-9 * Math.max(1, b.baseline), extraVolume };
  });
  const status = scenarios.some(s => !s.outcome.ok) ? "blocked" as const
    : scenarios.some(s => s.targetMet === false) ? "not-met" as const
      : scenarios.some(s => s.targetMet === null) ? "unknown" as const : "met" as const;
  const active = scenarios.find(s => s.id === activeScenario)!;
  const unhandledZones = active.outcome.ok ? Object.entries(active.outcome.value.remainingByZone)
    .filter(([, volume]) => volume > 1e-9)
    .map(([id, volume]) => ({ id, name: project.zones.find(z => z.id === id)?.name ?? id, volume }))
    .sort((a, b) => b.volume - a.volume || a.id.localeCompare(b.id)) : [];
  const planProject = { ...project, parameters: [...project.parameters.filter(p => !plan.parameters.some(saved => saved.id === p.id)), ...plan.parameters] };
  const checks = [...plan.components.filter(c => c.enabled).flatMap(interventionUnknowns), ...scenarioIds.flatMap(id => interventionReview(planProject, plan.components, id).map(note => note.message))];
  return { status, scenarios, checks, unhandledZones, target };
}

export type PlanRecommendation = {
  headline: string;
  summary: string;
  strengths: string[];
  actions: { title: string; detail: string }[];
  scenarioNotes: string[];
  improvement: string[];
  userReason: string | null;
};

export function planRecommendation(project: ProjectV2, plan: Plan, activeScenario: string): PlanRecommendation {
  const evaluated = evaluatePlan(project, plan, activeScenario);
  const scenarioName = project.scenarios.find(s => s.id === activeScenario)?.name ?? 'hujan aktif';
  const userReason = project.selectedPlan?.decisionNote?.trim() || null;
  if (!evaluated.ok) {
    return {
      headline: 'Lengkapi data rencana sebelum memakai rekomendasi ini.',
      summary: evaluated.issues.map(i => i.message).join(' '),
      strengths: [],
      actions: evaluated.issues.slice(0, 6).map((issue, index) => ({ title: `Lengkapi data ${index + 1}`, detail: issue.message })),
      scenarioNotes: [],
      improvement: [],
      userReason,
    };
  }
  const b = evaluated.value;
  const assessment = assessPackage(project, plan, activeScenario);
  const checks = planImplementationChecks(project, plan, activeScenario);
  const components = plan.components.filter(c => c.enabled);
  const handled = Math.max(0, b.baseline - b.residual);
  const percent = b.baseline > 0 ? handled / b.baseline * 100 : null;
  const fmt = (v: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v);
  const rupiah = (v: number) => `Rp${fmt(v)}`;
  const targetStatus = assessment.status === 'met' ? 'Target yang Anda nyatakan terpenuhi pada skenario wajib yang dapat dinilai.'
    : assessment.status === 'not-met' ? 'Target yang Anda nyatakan belum terpenuhi pada setidaknya satu skenario wajib.'
      : assessment.status === 'blocked' ? 'Target lintas skenario belum dapat dipastikan karena masih ada data atau syarat yang perlu ditinjau.'
        : assessment.target ? 'Target sudah dinyatakan, tetapi belum cukup data untuk menilainya.' : '';
  const headline = checks.length
    ? `Pilihan ini dapat diteruskan, dengan ${checks.length} pemeriksaan data/penerapan yang masih perlu ditinjau sebelum pelaksanaan.`
    : 'Pilihan ini siap dibawa ke verifikasi lapangan berdasarkan data yang sudah Anda nyatakan.';
  const strengths: string[] = [
    `Pada ${scenarioName}, rencana menangani ${fmt(handled)} m³ dari ${fmt(b.baseline)} m³ limpasan awal${percent === null ? '' : ` (${fmt(percent)}%)`} dan menyisakan ${fmt(b.residual)} m³.`,
    `Biaya ${rupiah(b.cost)} dari batas ${rupiah(b.budget)} dan lahan ${fmt(b.area)} m² dari ${fmt(b.usableArea)} m² yang Anda nyatakan.`,
  ];
  if (targetStatus) strengths.push(targetStatus);
  for (const component of components) {
    const disposition = b.components.find(row => row.id === component.id);
    const targets = component.targets.map(id => project.zones.find(z => z.id === id)?.name ?? 'zona tidak tersedia').join(', ') || 'target belum dinyatakan';
    strengths.push(`${component.name} diarahkan ke ${targets}${disposition ? ` dan menangani ${fmt(disposition.handled)} m³ pada skenario ini` : ''}.`);
  }
  const actions = checks.map(check => ({ title: check.label, detail: check.message }));
  const assessedScenarios = new Map(assessment.scenarios.map(row => [row.id, row]));
  const scenarioNotes = project.scenarios.map(scenario => {
    const outcome = evaluatePlan(project, plan, scenario.id);
    if (!outcome.ok) return `${scenario.name}: belum dapat dinilai — ${outcome.issues.map(i => i.message).join(' ')}`;
    const result = outcome.value;
    const handledScenario = result.baseline - result.residual;
    const assessed = assessedScenarios.get(scenario.id);
    return `${scenario.name}: ${fmt(handledScenario)} m³ tertangani, ${fmt(result.residual)} m³ tersisa${assessed?.targetMet === true ? ' · target terpenuhi' : assessed?.targetMet === false ? ` · masih perlu tambahan ${fmt(assessed.extraVolume ?? 0)} m³ penanganan untuk target` : ''}.`;
  });
  const improvement = assessment.unhandledZones.slice(0, 3).map(zone => `Jika ingin menekan sisa limpasan lebih lanjut, prioritaskan peninjauan ${zone.name}; masih tersisa sekitar ${fmt(zone.volume)} m³ pada neraca skenario aktif.`);
  if (!improvement.length && b.residual > 0) improvement.push(`Masih ada ${fmt(b.residual)} m³ sisa limpasan pada skenario aktif; evaluasi tambahan sebaiknya difokuskan pada sumber air yang belum tertangani tanpa mengubah pilihan secara otomatis.`);
  return {
    headline,
    summary: checks.length
      ? `Jumlah pemeriksaan dihitung dari seluruh penanganan dalam paket ${plan.name}, bukan hanya penanganan yang sedang dibuka. Ini bukan berarti ${checks.length} kolom belum diisi: daftar juga mencakup verifikasi lokasi/penerapan yang tetap diperlukan meski angka utama sudah lengkap. TIRTA tidak mengganti keputusan Anda atau memilih pemenang otomatis.`
      : `Rekomendasi ini menjelaskan cara menindaklanjuti pilihan ${plan.name}; TIRTA tidak mengganti keputusan Anda atau memilih pemenang otomatis.`,
    strengths,
    actions,
    scenarioNotes,
    improvement,
    userReason,
  };
}

// Alternatives already passed the explicit finite search and three-objective Pareto filter.
// A user goal describes the outcome; it does not introduce a weight, a winner, or a new objective.
export function packageRecommendations(project: ProjectV2, alternatives: readonly Alternative[], scenario: string) {
  return alternatives.map(candidate => ({ ...candidate, assessment: assessPackage(project, candidate.plan, scenario) }));
}

export type PackageTemplate = { id: string; name: string; reason: string; options: { family: ComponentVariant["family"]; targets: string[]; biopori?: boolean }[] };
export function parcelPackageTemplates(project: ProjectV2, scenario: string): PackageTemplate[] {
  const baseline = productionBaseline(project, scenario);
  if (!baseline.ok || baseline.value.runoffM3 === 0) return [];
  const active = project.zones.filter(z => baseline.value.zones.some(v => v.id === z.id && v.runoffM3 > 0));
  const roofs = active.filter(z => z.surface === "roof").map(z => z.id);
  const ground = active.filter(z => z.surface !== "roof").map(z => z.id);
  const groundLocations = project.zones.filter(z => z.surface === 'soil' || z.surface === 'vegetation');
  const supportsExploration = (zoneId: string) => siteGuidance(project, scenario, { sourceZoneIds: ground, installationZoneId: zoneId }).find(g => g.id === 'rain-garden')?.status !== 'conflict';
  // UNKNOWN remains a next-question draft. Explicitly contradictory site facts withdraw a template;
  // they never become an invented capacity multiplier or a universal method prohibition.
  const hasGardenLocation = !groundLocations.length || groundLocations.some(z => supportsExploration(z.id));
  const templates: PackageTemplate[] = [];
  if (roofs.length) templates.push({ id: "roof-harvest", name: "Tangki untuk air atap", reason: "Atap menyumbang limpasan pada hujan ini. Tampung untuk penggunaan nonkonsumsi dengan penyaluran dan pengosongan yang direncanakan.", options: [{ family: "storage", targets: roofs }] });
  if (ground.length && hasGardenLocation) templates.push({ id: "vegetated", name: roofs.length ? "Tangki + taman hujan" : "Taman hujan", reason: "Alternatif vegetasi terencana untuk limpasan permukaan. Zona vegetasi biasa tetap baseline; paket ini memerlukan ruang, media, tanaman, penyaluran, dan kapasitas infiltrasi tambahan yang dinyatakan.", options: [...(roofs.length ? [{ family: "storage" as const, targets: roofs }] : []), { family: "rain-garden", targets: ground }] });
  const contexts = active.map(z => ({ zone: z, context: project.science?.surfaces[z.id] }));
  const compacted = contexts.some(x => x.context?.soil.compaction === 'compacted');
  const noSoil = !project.zones.some(z => (z.surface === 'soil' || z.surface === 'vegetation') && (project.science?.surfaces[z.id]?.soil.infiltration.value ?? null) !== null);
  const clogged = contexts.filter(x => x.zone.surface === 'porous' && x.context?.porous.clogging === 'observed');
  const outletUnknown = contexts.some(x => x.zone.surface === 'roof' && (!x.context || x.context.roof.outlet === 'unknown'));
  return templates.map(t => ({ ...t, reason: t.reason +
    (t.options.some(o => o.family === 'storage') && outletUnknown ? ' Outlet atap belum lengkap; periksa jalur masuk tangki, termasuk atap besar dengan beberapa outlet.' : '') +
    (t.options.some(o => o.family !== 'storage') && noSoil ? ' Bukti tanah lokasi penerapan belum tersedia; paket belum membuktikan kelayakan resapan.' : '') +
    (t.options.some(o => o.family !== 'storage') && compacted ? ' Ada catatan tanah padat. Periksa lokasi penerapan dan uji infiltrasi; kapasitas tidak diturunkan dari tekstur.' : '') +
    (clogged.length ? ` Penyumbatan tercatat pada ${clogged.map(x => x.zone.name).join(', ')}; periksa pemeliharaan dan kesesuaian C sebelum memakai hasil.` : '')
  }));
}

export function packageConclusionText(project: ProjectV2, plan: Plan, scenario: string, alternatives: readonly Alternative[]): string[] {
  const a = assessPackage(project, plan, scenario);
  const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);
  const labels = { met: "Target tercapai pada model", "not-met": "Target belum tercapai", blocked: "Paket tidak memenuhi data / batas", unknown: "Target belum dapat dinilai" };
  const matches = packageRecommendations(project, alternatives, scenario).filter(p => p.plan.id !== plan.id && p.assessment.status === "met");
  return [labels[a.status], a.target ? `Target pengguna: ${fmt(a.target.value)} ${a.target.metric === "reduction-percent" ? "% minimal pengurangan" : "m³ maksimal sisa"}. Sumber: ${a.target.source}.` : "Target ukuran keberhasilan belum ditetapkan.",
    ...a.scenarios.map(s => `${s.name}: ${!s.outcome.ok ? s.outcome.issues.map(i => i.message).join(" ") : s.targetMet === null ? "target belum dapat dinilai" : s.targetMet ? "target terpenuhi" : `perlu menangani tambahan ${fmt(s.extraVolume!)} m³`}`),
    ...a.checks,
    ...a.unhandledZones.map(z => `Sisa dari ${z.name}: ${fmt(z.volume)} m³.`),
    "Paket lain yang memenuhi target dan batas:",
    ...(matches.length ? matches.map(m => `${m.plan.components.filter(c => c.enabled).map(c => c.name).join(" + ") || "Tanpa intervensi"}: Rp${fmt(m.balance.cost)}, ${fmt(m.balance.area)} m², ${fmt(m.balance.residual)} m³ sisa pada hujan aktif; ${m.assessment.checks.length} kondisi penerapan belum lengkap.`) : ["Belum tersedia dari pilihan yang dinyatakan; coba varian kapasitas atau komposisi berdasar data yang diketahui."]),
    "Keberhasilan ini adalah target volume pra-perencanaan, bukan bukti bebas genangan atau sertifikasi konstruksi."];
}
