import { projectV2Schema, type ProjectV2 } from '../domain/projectV2';
import { evaluatePlan, evaluateEventPlan, optimize, planningFingerprint, legacyPlanningFingerprint, allocationSequence, familyLabels, snapshotPlan } from '../domain/planningEngine';
import { productionBaseline } from '../domain/productionBaseline';
import { decisionPackage, comparisonExplanation, componentReference, componentResearch } from '../domain/decisionSupport';
import { assessIntervention, feasibilityLabels } from '../domain/feasibility';
import { assessPackage, planRecommendation, type PlanRecommendation } from '../domain/packageRecommendations';
import { scientificClaims, authoritativeReferences } from '../domain/evidenceRegistry';
import { journalEvidence } from '../domain/evidenceCatalog';
import { assessFieldEvaluation } from '../domain/fieldEvaluation';
import { surfaceLabels } from '../domain/model';
import type { ReferenceV2, ParameterV2 } from '../domain/v2-primitives';
import { parcelFigure, balanceFigure, contributionFigure, reasoningFigure, resourceFigure } from './reportFigures';
import { scientificContextRows } from './scientificContext';
import { pilotSearchProject, retiredPilotPlan, pilotRetirementReason } from '../domain/pilotPolicy';
import { fieldObservationReport, fieldObservationLimitation } from '../domain/fieldObservations';

export const number = (v: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v);
const ratio = (v: number) => new Intl.NumberFormat('id-ID', { maximumSignificantDigits: 21 }).format(v);
export const currency = (v: number) => `Rp${number(v)}`;
export type ReportBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'figure'; svg: string; caption: string };
export type ReportSection = { id: string; title: string; blocks: ReportBlock[] };
export type ProjectReport = {
  version: 1; includeSources:boolean; detail:'summary'|'detailed'; projectId: string; revision: number; inputFingerprint: string;
  title: string; mode: ProjectV2['mode']; updatedAt: string;
  state: 'draft' | 'selected' | 'stale' | 'alternative'; status: string;
  scenarioId: string; scenarioName: string; planName: string;
  metrics: { baseline: number; residual: number; stored: number; reused: number; infiltrated: number; cost: number; area: number } | null;
  recommendation: PlanRecommendation | null;
  sections: ReportSection[];
};
const units: Record<ReferenceV2['unit'], string> = { mm: 'mm', m: 'm', m2: 'm²', 'm3/event': 'm³/kejadian', ratio: '', IDR: 'Rp' };
const origins: Record<ParameterV2['evidence'], string> = {
  UNKNOWN: 'Belum diketahui', ASSUMPTION: 'Asumsi pengguna', USER_INPUT: 'Dinyatakan pengguna', MEASURED: 'Pengukuran', SOURCE_DERIVED: 'Dari referensi', ASSIST_SUGGESTION: 'Saran belum dikonfirmasi', DEMO: 'Contoh sintetis',
};
const text = (value: string): ReportBlock => ({ kind: 'text', text: value });
const list = (items: string[]): ReportBlock => ({ kind: 'list', items: [...new Set(items.filter(Boolean))] });
const table = (headers: string[], rows: string[][]): ReportBlock => ({ kind: 'table', headers, rows });

/** Pure, versioned projection. No stored report, second calculator, time, network or prose model. */
export function buildProjectReport(input: ProjectV2, scenarioId: string, options:{includeSources?:boolean; detail?:'summary'|'detailed'; planScope?:'selected'|'active'|'alternative'; planId?:string; comparisonPlanId?:string}={}): ProjectReport {
  const includeSources=options.includeSources ?? false;
  const detail=options.detail ?? 'summary';
  const p = projectV2Schema.parse(input);
  const sid = p.scenarios.some(s => s.id === scenarioId) ? scenarioId : p.scenarios[0]?.id ?? '';
  const scenario = p.scenarios.find(s => s.id === sid);
  const alternativeSearch=options.planScope==='alternative' ? optimize(pilotSearchProject(p),sid) : null;
  const alternative=alternativeSearch?.ok ? alternativeSearch.value.alternatives.find(a=>a.plan.id===options.planId) : null;
  const unavailableAlternative=options.planScope==='alternative' && !alternative;
  const chosen = options.planScope === 'active' || options.planScope==='alternative' ? null : p.selectedPlan;
  const fingerprint = planningFingerprint(p);
  const stale = !!chosen && chosen.reviewedInputFingerprint !== fingerprint;
  const plan = alternative?.plan ?? chosen?.definition ?? snapshotPlan(p, unavailableAlternative ? [] : p.components.filter(c => c.enabled).map(c => c.id), 'report-draft', 'Intervensi yang sedang disusun');
  const parameters = [...p.parameters.filter(v => !plan.parameters.some(q => q.id === v.id)), ...plan.parameters];
  const parameter = (ref: ReferenceV2, scenario = sid, values = parameters) => {
    const override = p.scenarios.find(s => s.id === scenario)?.overrides.find(o => o.baseParameterId === ref.id)?.replacement;
    const effective = override ?? ref;
    const v = values.find(v => v.id === effective.id);
    return v && v.unit === effective.unit && v.evidence === effective.evidence ? v : undefined;
  };
  const value = (ref: ReferenceV2, scenario = sid, values = parameters) => {
    const v = parameter(ref, scenario, values);
    return v?.value == null || v.evidence === 'UNKNOWN' ? 'Belum diketahui' : v.unit === 'IDR' ? currency(v.value) : v.unit === 'ratio' ? ratio(v.value) : `${number(v.value)}${units[v.unit] ? ` ${units[v.unit]}` : ''}`;
  };
  const baseline = productionBaseline(p, sid);
  const evaluation = !stale && !unavailableAlternative ? evaluatePlan(p, plan, sid) : null;
  const balance = evaluation?.ok ? evaluation.value : null;
  const recommendation = !stale && !unavailableAlternative ? planRecommendation(p, plan, sid) : null;
  const decision = balance ? decisionPackage(p, plan, sid) : null;
  const state = stale ? 'stale' : chosen ? 'selected' : alternative ? 'alternative' : 'draft';
  const status = unavailableAlternative ? 'Alternatif tidak tersedia pada data saat ini. Pilih kembali paket yang akan dilaporkan.' : stale ? 'Input berubah. Pilihan lama belum ditinjau ulang; hasil rencana tidak ditampilkan.'
    : alternative ? 'Alternatif yang ditinjau; belum mengganti rencana pilihan Anda.'
    : !chosen ? p.selectedPlan ? 'Draf intervensi aktif; laporan ini tidak menggunakan rencana pilihan yang tersimpan.' : 'Draf proyek. Belum ada rencana pilihan pengguna.'
      : !balance ? 'Pilihan disimpan, tetapi hasil pada hujan ini belum dapat dinilai.' : 'Rencana pilihan pengguna · hasil sesuai input yang ditinjau.';
  const sections: ReportSection[] = [];
  const add = (id: string, title: string, blocks: ReportBlock[]) => sections.push({ id, title, blocks });
  const dominant = baseline.ok ? [...baseline.value.zones].sort((a, b) => b.runoffM3 - a.runoffM3 || a.id.localeCompare(b.id))[0] : null;
  const mainZone = dominant && p.zones.find(z => z.id === dominant.id);
  const conclusion: string[] = [];
  conclusion.push(baseline.ok
    ? `Pada ${number(baseline.value.rainfallMm)} mm, ${number(baseline.value.areaM2)} m² zona menghasilkan ${number(baseline.value.runoffM3)} m³ limpasan awal. ${dominant && mainZone && baseline.value.runoffM3 > 0 ? `${mainZone.name} (${mainZone.surface ? surfaceLabels[mainZone.surface] : 'permukaan belum diketahui'}) menyumbang paling banyak: ${number(dominant.runoffM3)} m³ (${number(dominant.runoffM3 / baseline.value.runoffM3 * 100)}%).` : 'Limpasan awal nol; persentase penanganan tidak dihitung.'}`
    : `Limpasan awal belum dapat dihitung. ${baseline.issues.map(i => i.message).join(' ')}`);
  if (balance) {
    conclusion.push(`${chosen ? 'Anda memilih' : alternative ? 'Alternatif yang ditinjau adalah' : 'Paket yang sedang disusun adalah'} ${plan.components.filter(c => c.enabled).map(c => c.name).join(' + ') || 'tanpa intervensi'}. ${chosen ? 'Pilihan ini milik pengguna, bukan pemenang otomatis TIRTA. ' : 'Belum merupakan keputusan akhir. '}${number(balance.baseline - balance.residual)} m³ ditangani; ${number(balance.residual)} m³ masih tersisa. Biaya ${currency(balance.cost)} dari batas ${currency(balance.budget)}, lahan ${number(balance.area)} dari ${number(balance.usableArea)} m².`);
    if (chosen?.decisionNote && chosen.decisionNote !== 'Dipilih pengguna setelah membandingkan trade-off.') conclusion.push(`Alasan Anda: ${chosen.decisionNote}`);
    if (decision?.ok) conclusion.push(decision.robustness);
    const assessment = assessPackage(p, plan, sid);
    if(p.planningGoal.target)conclusion.push(assessment.status === 'met' ? 'Target yang dinyatakan terpenuhi pada skenario wajib yang dapat dinilai.' : assessment.status === 'not-met' ? 'Target yang dinyatakan belum terpenuhi pada setidaknya satu skenario wajib.' : assessment.status === 'blocked' ? 'Target lintas skenario belum dapat dinilai; ada data atau kondisi yang belum memenuhi syarat.' : 'Target yang dinyatakan belum dapat dinilai; hasil volume bukan bukti target tercapai.');
  }
  if (!balance && !stale && !unavailableAlternative) {
    const waterDraft=!chosen&&!alternative ? evaluateEventPlan(p,plan,sid) : null;
    if(waterDraft?.ok) conclusion.push(`Neraca air draf dapat dihitung: ${number(waterDraft.value.baseline-waterDraft.value.residual)} m³ ditangani dan ${number(waterDraft.value.residual)} m³ tersisa. Paket belum dapat dibandingkan.${evaluation && !evaluation.ok ? ` ${evaluation.issues.map(i=>i.message).join(' ')}` : ''} Tinjau biaya, lahan dan batas rencana; ini belum merupakan rencana yang layak diterapkan.`);
    else conclusion.push(`Dampak belum dapat dihitung.${evaluation && !evaluation.ok ? ` ${evaluation.issues.map(i => i.message).join(' ')}` : ''} Lengkapi data penanganan yang masih kurang sebelum menilai hasil.`);
  }
  if (p.planningGoal.note) conclusion.push(`Tujuan proyek: ${p.planningGoal.note}`);
  if(retiredPilotPlan(plan))conclusion.push(`Paket historis memuat penanganan yang telah dihentikan pada pilot. ${pilotRetirementReason}`);
  conclusion.push('Hasil adalah neraca volume satu kejadian berdasarkan input dan kapasitas yang dinyatakan. Tidak memprediksi kedalaman genangan, debit puncak, keamanan, kepatuhan standar atau desain konstruksi. Non-limpasan bukan otomatis infiltrasi.');
  add('summary', 'Kesimpulan proyek', [...(balance ? [{ kind: 'figure' as const, svg: balanceFigure(balance), caption: `Neraca konservasi: ${number(balance.baseline)} = ${number(balance.stored)} ditampung + ${number(balance.reused)} digunakan kembali + ${number(balance.infiltrated)} diinfiltrasikan + ${number(balance.residual)} tersisa m³. Disposisi tidak dihitung dua kali.` },{kind:'figure' as const,svg:resourceFigure(balance),caption:'Biaya dan lahan yang digunakan terhadap batas yang dinyatakan. Batas nol tidak menghasilkan persentase.'}] : []), ...conclusion.map(text)]);

  add('parcel', 'Persil dan kontribusi permukaan', [
    text(`Luas persil: ${p.parcel ? value(p.parcel.area, sid, p.parameters) : 'Belum diketahui'} · ${p.zones.length} zona. ${p.zones.some(z=>z.geometryContext==='schematic-area') ? 'Sketsa memuat tata letak otomatis; bentuk area sederhana belum diukur. Luas pada tabel berasal dari input pengguna, bukan ukuran gambar.' : p.drawingScale ? 'Sketsa berskala meter dari dimensi yang dinyatakan; bukan peta lokasi.' : 'Geometri skematis; bentuk visual tidak membuktikan luas atau sambungan air.'}`),
    ...(p.zones.length ? [{ kind: 'figure' as const, svg: parcelFigure(p, plan), caption: plan.components.some(c=>c.enabled) ? 'Sketsa persil: nomor merujuk ke zona, I ke penanganan pada tabel paket; garis tepi berwarna menandai area sumber. Posisi penanganan skematis, bukan simulasi jalur atau kedalaman air.' : 'Nomor pada sketsa merujuk ke tabel zona. Sketsa bukan peta lokasi atau simulasi aliran air.' }] : []),
    ...fieldObservationReport(p).map(text),
    ...(baseline.ok && baseline.value.runoffM3 > 0 ? [{ kind: 'figure' as const, svg: contributionFigure(p, baseline.value), caption: 'Kontribusi terbesar pada hujan aktif. Daftar lengkap ada di tabel; panjang batang menunjukkan volume limpasan, bukan tinggi genangan.' }] : []),
    table(['Zona / permukaan', 'Luas', 'Koefisien limpasan', 'Limpasan awal'], p.zones.map((z, i) => {
      const b = baseline.ok ? baseline.value.zones.find(v => v.id === z.id) : null;
      return [`${i + 1}. ${z.name}\n${z.surface ? surfaceLabels[z.surface] : 'Permukaan belum diketahui'}`, b ? `${number(b.areaM2)} m²` : value(z.area, sid, p.parameters), b ? ratio(b.coefficient) : value(z.coefficient, sid, p.parameters), b ? `${number(b.runoffM3)} m³` : 'Belum dapat dihitung'];
    })),
    list(p.zones.flatMap(z => {
      const roof = p.science?.surfaces[z.id]?.roof;
      return [z.surfaceContext ? `${z.name}: ${z.surfaceContext}` : '', z.surface === 'roof' && roof ? `${z.name}: kemiringan ${roof.pitch?.value == null ? 'belum diketahui' : `${number(roof.pitch.value)}°${includeSources ? ` (${roof.pitch.source})` : ''}`}; material ${roof.material || 'belum dicatat'}. Kemiringan adalah konteks, bukan pengali C atau volume otomatis.` : ''];
    })),
  ]);

  add('rain', 'Hujan dan uji lintas skenario', [
    table([includeSources ? 'Skenario / sumber' : 'Skenario', 'Hujan / durasi', 'Limpasan awal', 'Sisa rencana'], p.scenarios.map(s => {
      const b = productionBaseline(p, s.id);
      const r = !stale && !unavailableAlternative ? evaluatePlan(p, plan, s.id) : null;
      const rain = parameter(s.rainfall, s.id, p.parameters);
      const duration = p.science?.rainfall[s.id];
      return [`${s.name}${s.id === sid ? ' · aktif' : ''}\n${rain ? origins[rain.evidence] : 'Belum diketahui'}${includeSources ? `: ${rain?.source || 'Belum dicatat'}` : ''}${s.eventWindowNote ? `\n${s.eventWindowNote}` : ''}`, `${value(s.rainfall, s.id, p.parameters)}\nDurasi: ${duration?.value == null ? 'belum diketahui' : `${number(duration.value)} menit${includeSources ? ` · ${duration.source}` : ''}`}`, b.ok ? `${number(b.value.runoffM3)} m³` : `Belum dapat dihitung: ${b.issues.map(i => i.message).join(' ')}`, r?.ok ? `${number(r.value.residual)} m³` : stale ? 'Pilihan belum ditinjau ulang' : `Belum dapat dinilai${r && !r.ok ? `: ${r.issues.map(i => i.message).join(' ')}` : ''}`];
    })), text('Skenario uji adalah asumsi yang ditentukan pengguna; bukan ramalan cuaca. Hasil hanya berlaku pada hujan dan kapasitas kejadian yang dinyatakan. Durasi tidak diubah menjadi simulasi debit puncak.'),
  ]);

  const planComponents = plan.components.filter(c => c.enabled);
  const assessments=planComponents.map(c=>assessIntervention(p,c,sid,plan.parameters,plan.scientificEvidence?.[c.id]));
  const sharedChecks=new Map<string,{message:string;items:string[];basis:string}>();
  assessments.forEach((f,i)=>{
    for(const [kind,notes] of [['Dasar',f.reasons],['Syarat',f.conditions],['Data kurang',f.missing]] as const){
      for(const v of notes){
        const basis=`${kind}${includeSources ? ` [${v.evidenceIds.join(', ')}]` : ''}`;
        const key=JSON.stringify([v.message,basis]);
        const row=sharedChecks.get(key) ?? {message:v.message,items:[],basis};
        row.items.push(`I${i+1}`);sharedChecks.set(key,row);
      }
    }
  });
  add('plan', chosen ? 'Rencana pilihan dan syarat penerapan' : 'Intervensi yang sedang disusun', [
    text(`${plan.name}. ${status}`),
    table(['Intervensi / sumber air', 'Kapasitas pada hujan aktif', 'Biaya / lahan', 'Penyaringan'], planComponents.map((c,i) => {
      const perf = c.performanceByScenario[sid];
      const ref = perf && ('availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
      const f = assessIntervention(p, c, sid, plan.parameters, plan.scientificEvidence?.[c.id]);
      const installation = p.zones.find(z => z.id === c.treatment?.installationZoneId);
      return [`I${i+1}. ${c.name}\n${familyLabels[c.family]}\nSumber: ${c.targets.map(id => p.zones.find(z => z.id === id)?.name ?? 'Area sumber tidak tersedia').join(', ') || 'Belum dinyatakan'}\nLokasi: ${installation?.name ?? (c.placement ? 'posisi simbol skematis; area pemasangan belum dinyatakan' : 'belum dinyatakan')}`, ref ? `${value(ref)}\n${origins[parameter(ref)?.evidence ?? 'UNKNOWN']}` : 'Belum diketahui', `${value(c.totalCost)}\n${value(c.occupiedArea)}`, feasibilityLabels[f.status]];
    })),
    ...planComponents.flatMap(c => {
      const f = assessIntervention(p, c, sid, plan.parameters, plan.scientificEvidence?.[c.id]);
      const disposition = balance?.components.find(t => t.id === c.id);
      return [text(`${c.name} — ${feasibilityLabels[f.status]}${disposition ? `; volume tertangani ${number(disposition.handled)} m³` : ''}. ${c.connectionNote || 'Catatan sambungan belum tersedia.'}`), ...(c.planningNotes ? [text(`Catatan operasi: ${c.planningNotes}`)] : [])];
    }),
    ...(sharedChecks.size ? [text('Pemeriksaan yang sama ditulis sekali. Penanda I merujuk ke intervensi pada tabel di atas; setiap syarat tetap berlaku pada semua intervensi yang dicantumkan.'),table(['Pemeriksaan', 'Intervensi', 'Status / dasar'],[...sharedChecks.values()].map(r=>[r.message,r.items.join(', '),r.basis]))] : []),
    text(`Batas biaya: ${value(p.constraints.budget)}. Lahan tersedia: ${value(p.constraints.usableArea)}. Target: ${p.planningGoal.target ? `${number(p.planningGoal.target.value)}${p.planningGoal.target.metric === 'reduction-percent' ? '% pengurangan limpasan' : ' m³ sisa limpasan'}${includeSources ? ` · ${p.planningGoal.target.source}` : ''}` : 'Belum dinyatakan'}.`),
    list(p.components.filter(c => !plan.components.some(saved => saved.id === c.id && saved.enabled)).map(c => `${c.name} (${familyLabels[c.family]}): ${c.enabled ? 'opsi yang dipertimbangkan, tidak masuk paket ini' : 'disimpan untuk nanti, tidak aktif dalam pencarian'}.`)),
  ]);

  const search = alternativeSearch ?? optimize(pilotSearchProject(p), sid);
  if (options.comparisonPlanId) {
    const candidate = search.ok ? search.value.alternatives.find(a => a.plan.id === options.comparisonPlanId) : undefined;
    add('comparison', 'Alternatif pembanding', candidate ? [
      text('Satu paket pembanding dipilih untuk laporan ini. Paket tersebut tidak mengganti rencana Anda.'),
      table(['Paket', 'Sisa', 'Biaya', 'Lahan'], [
        ...(balance ? [[`${plan.name} · hasil laporan`, `${number(balance.residual)} m³`, currency(balance.cost), `${number(balance.area)} m²`]] : []),
        [candidate.plan.components.filter(c => c.enabled).map(c => c.name).join(' + ') || 'Tanpa intervensi', `${number(candidate.balance.residual)} m³`, currency(candidate.balance.cost), `${number(candidate.balance.area)} m²`],
      ]),
      ...(balance ? [text(comparisonExplanation({ plan, balance }, candidate))] : []),
    ] : [text('Paket pembanding tidak tersedia pada data dan batas saat ini. Pilih kembali sebelum mengunduh.')]);
  }

  add('trace', 'Bagaimana hasil ini terbentuk', [
    {kind:'figure',svg:reasoningFigure([
      {title:'Persil',value:`${p.zones.length} zona / luas dan C yang dinyatakan`},
      {title:'Hujan aktif',value:scenario ? value(scenario.rainfall,sid,p.parameters) : 'Belum dinyatakan'},
      {title:'Limpasan awal',value:baseline.ok ? `${number(baseline.value.runoffM3)} m³ / dari luas, hujan dan C` : 'Belum dapat dihitung'},
      {title:'Batas dan kelayakan',value:'Biaya, lahan dan syarat penerapan diperiksa'},
      {title:'Alternatif',value:search.ok ? `${search.value.alternatives.length} trade-off Pareto / bukan peringkat` : 'Data belum cukup'},
      {title:'Keputusan pengguna',value:chosen ? stale ? 'Pilihan belum ditinjau ulang' : 'Paket pilihan Anda' : 'Paket belum dipilih'},
      {title:'Neraca rencana',value:balance ? `${number(balance.baseline)} m³ masuk / ${number(balance.residual)} m³ tersisa` : 'Hasil rencana belum tersedia'},
    ]),caption:'Alur data dan keputusan yang membentuk laporan. Panah menunjukkan urutan peninjauan, bukan sambungan air di lapangan.'},
    list([
      `1. Persil → ${p.zones.length} zona, luas dan koefisien yang dinyatakan.`,
      `2. Hujan → ${scenario ? `${scenario.name}, ${value(scenario.rainfall, sid, p.parameters)}` : 'Belum dinyatakan'}.`,
      `3. Baseline → ${baseline.ok ? `${number(baseline.value.runoffM3)} m³` : 'belum dapat dihitung'}. V hujan = luas × hujan / 1.000; V limpasan = V hujan × C.`,
      `4. Batas → ${value(p.constraints.budget)} dan ${value(p.constraints.usableArea)}; syarat lokasi diperiksa terpisah dari neraca volume.`,
      `5. Alternatif → ${search.ok ? `${search.value.alternatives.length} trade-off Pareto dari opsi yang dinyatakan` : 'data belum cukup untuk pencarian'}.`,
      `6. Keputusan → ${chosen ? `${plan.name}, dipilih pengguna${stale ? ', belum ditinjau ulang' : ''}` : 'belum dipilih'}.`,
      `7. Neraca → ${balance ? `${number(balance.baseline)} m³ masuk; ${number(balance.residual)} m³ tersisa` : 'hasil rencana belum tersedia'}. Volume dibatasi air sumber dan tidak dihitung dua kali.`,
    ]),
    text('Urutan pembukuan volume, bukan jalur hidraulik: konversi berpori lokal dahulu; intervensi lain sesuai prioritas rencana. Posisi simbol pada sketsa tidak membuktikan sambungan.'),
    list(allocationSequence(plan).map((c, i) => `${i + 1}. ${c.name}: sumber ${c.targets.map(id => p.zones.find(z => z.id === id)?.name ?? 'Area sumber tidak tersedia').join(' → ') || 'belum dinyatakan'}.`)),
    list((p.science?.connections ?? []).filter(c=>!c.candidateId || planComponents.some(v=>v.id===c.candidateId)).map(c => {
      const dest = c.destination;
      const label = dest.kind === 'zone' ? p.zones.find(z => z.id === dest.id)?.name ?? dest.id : dest.kind === 'intervention' ? p.components.find(v => v.id === dest.id)?.name ?? dest.id : dest.kind === 'unknown' ? 'Tujuan belum diketahui' : dest.note || (dest.kind === 'outside' ? 'Di luar persil' : 'Saluran drainase');
      return `${p.zones.find(z => z.id === c.sourceZoneId)?.name ?? c.sourceZoneId} → ${label}. ${includeSources ? `${c.source || 'Dasar sambungan belum diketahui'}; ` : ''}${c.origin}.`;
    })),
  ]);

  const provenance: string[][] = [];
  const record = (label: string, ref: ReferenceV2, scenario = sid, values = parameters) => {
    const v = parameter(ref, scenario, values);
    provenance.push([label, value(ref, scenario, values), v ? origins[v.evidence] : 'Belum diketahui', [v?.source, v?.note, v?.applicability].filter(Boolean).join('\n') || 'Belum dicatat']);
  };
  if (p.parcel) record('Luas persil', p.parcel.area, sid, p.parameters);
  p.zones.forEach(z => { record(`${z.name} · luas`, z.area, sid, p.parameters); record(`${z.name} · C`, z.coefficient, sid, p.parameters); });
  p.scenarios.forEach(s => record(`${s.name} · hujan`, s.rainfall, s.id, p.parameters));
  record('Batas biaya', p.constraints.budget); record('Lahan tersedia', p.constraints.usableArea);
  planComponents.forEach(c => {
    record(`${c.name} · biaya`, c.totalCost); record(`${c.name} · lahan`, c.occupiedArea);
    if (c.family === 'permeable') record(`${c.name} · luas diganti`, c.treatedArea);
    p.scenarios.forEach(s => {
      const perf = c.performanceByScenario[s.id];
      if (!perf) { provenance.push([`${c.name} · ${s.name} · kapasitas`, 'Belum diketahui', 'Belum diketahui', 'Kapasitas belum dinyatakan untuk hujan ini']); return; }
      record(`${c.name} · ${s.name} · kapasitas`, 'availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity, s.id);
      if ('reuse' in perf && perf.reuse.mode !== 'off') record(`${c.name} · ${s.name} · kebutuhan reuse`, perf.reuse.demand, s.id);
    });
  });
  const checks = [
    ...(!baseline.ok ? baseline.issues.map(i => i.message) : []),
    ...(evaluation && !evaluation.ok ? evaluation.issues.map(i => i.message) : []),
    ...(decision?.ok ? [...decision.checks, ...decision.tradeoffs] : []),
  ];
  const fieldChecks=new Map<string,string[]>();
  assessments.forEach((f,i)=>f.fieldChecks.forEach(v=>{const items=fieldChecks.get(v) ?? [];items.push(`I${i+1}`);fieldChecks.set(v,items);}));
  add('verification', 'Data belum pasti dan langkah lapangan', [
    ...(p.zones.some(z=>['ponding','concentrated-runoff'].includes(p.science?.surfaces[z.id]?.fieldObservation?.condition ?? 'unknown')) ? [text(fieldObservationLimitation)] : []),
    list(provenance.filter(r => r[2] === origins.UNKNOWN || r[2] === origins.ASSUMPTION || r[2] === origins.DEMO).map(r => `${r[0]}: ${r[1]} · ${r[2]}.`)),
    list(checks),
    ...(sharedChecks.size ? [text('Data kurang dan syarat tiap intervensi tercantum pada Pemeriksaan di bagian Rencana; status tersebut tidak diubah menjadi kepastian kelayakan.')] : []),
    table(['Verifikasi lapangan', 'Intervensi'],[...fieldChecks].map(([message,items])=>[message,items.join(', ')])),
    text('Sebelum penerapan, verifikasi luas penangkap, jalur sumber/kelebihan air, dasar kapasitas kejadian, kondisi tanah dan muka air tanah yang relevan, biaya aktual serta pemeliharaan. Referensi penelitian tidak membuktikan performa lokasi ini.'),
    ...((p.science?.observations ?? []).map(v => { const f = assessFieldEvaluation(v); return text(`Observasi ${v.before.date || 'tanggal belum diketahui'} → ${v.after.date || 'tanggal belum diketahui'}: ${f.label}. ${f.explanation}`); })),
  ]);
  if(includeSources)add('provenance', 'Input, sumber dan asumsi', [table(['Input', 'Nilai', 'Status', 'Sumber / catatan / batas'], provenance)]);
  add('context', 'Kondisi lokasi dan dasar kapasitas', [table(includeSources ? ['Zona / intervensi', 'Kondisi yang dinyatakan', 'Dasar'] : ['Zona / intervensi', 'Kondisi yang dinyatakan'], scientificContextRows(p,plan,includeSources).map(r=>includeSources ? r : r.slice(0,2))), text('Konteks permukaan, tanah dan konstruksi membantu peninjauan kelayakan. Data ini tidak menetapkan C atau kapasitas numerik secara otomatis.')]);
  const usedIds = new Set(['CLAIM-VOLUME', 'CLAIM-VOLUME-LIMIT', 'CLAIM-CONNECTION', 'CLAIM-PARETO', ...planComponents.flatMap(c => {
    const f = assessIntervention(p, c, sid, plan.parameters, plan.scientificEvidence?.[c.id]);
    return [...f.reasons, ...f.missing, ...f.conditions].map(v => v.claimId);
  })]);
  add('method', 'Metode dan batas penggunaan', [
    text('Metode TIRTA: neraca kejadian deterministik, event-ledger-v1; model laporan v1. Masukan ilmiah yang sama menghasilkan hasil yang sama. Kapasitas kejadian tidak diturunkan otomatis dari ukuran tangki, luas tanah, jumlah lubang atau kemiringan atap.'),
    ...(includeSources ? scientificClaims.filter(c => usedIds.has(c.id)).map(c => text(`[${c.id}] ${c.wording} Batas: ${c.limitations} [${c.evidenceIds.join(', ')}]`)) : []),
    text('Laporan memuat data dan sumber yang Anda masukkan. Periksa informasi pribadi sebelum membagikannya. Laporan bukan berkas untuk melanjutkan pengeditan; gunakan cadangan proyek. Tidak ada data yang dikirim ke server untuk membuat laporan.'),
  ]);
  const refs = planComponents.flatMap(c => [componentReference(c), componentResearch(c)]);
  if(includeSources)add('sources', 'Referensi dan relevansi', [
    ...[...new Map(refs.map(r => [r.url, r])).values()].map(r => text(`${r.name}\n${r.url}${'relevance' in r ? `\nRelevansi: ${r.relevance}` : ''}`)),
    text('Katalog berikut adalah dasar pengetahuan dan batas metode, bukan sumber otomatis untuk semua angka proyek. Dasar setiap angka tercatat pada bagian Input, sumber dan asumsi.'),
    ...journalEvidence.filter(e=>scientificClaims.some(c=>usedIds.has(c.id) && c.evidenceIds.includes(e.id))).map(e => text(`[${e.id}] ${e.authors.join(', ')} (${e.year}). ${e.title}. ${e.journal}.${e.doi ? ` DOI: ${e.doi}.` : ''}\n${e.url}\nRelevansi: ${e.localRelevance}\nBatas: ${e.limitations}`)),
    ...authoritativeReferences.filter(e=>scientificClaims.some(c=>usedIds.has(c.id) && c.evidenceIds.includes(e.id))).map(e => text(`[${e.id}] ${e.title}\n${e.url}\nBatas: ${e.limitation}`)),
  ]);
  // Repeated long user sources/notes get a single full entry, never a truncation.
  // This keeps dense projects from repeating the same citation dozens of times.
  const sourceTexts = new Set<string>();
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      if (['source','note','applicability','eventWindowNote','method'].includes(key) && typeof child === 'string' && child.length >= 120) sourceTexts.add(child);
      else if (key !== 'photo') collect(child);
    }
  };
  if(includeSources){collect(p.parameters); collect(plan.parameters); collect(p.scenarios); collect(p.science);}
  const entries:string[]=[];
  for (const source of [...sourceTexts].sort((a,b)=>b.length-a.length || a.localeCompare(b))) {
    let occurrences=0;
    const count=(value:string)=>{occurrences+=value.split(source).length-1;};
    sections.forEach(s=>s.blocks.forEach(b=>{if(b.kind==='text')count(b.text);else if(b.kind==='list')b.items.forEach(count);else if(b.kind==='table')b.rows.forEach(r=>r.forEach(count));}));
    if(occurrences<2)continue;
    const id=`D${entries.length+1}`;
    const replace=(v:string)=>v.replaceAll(source,`[${id}]`);
    sections.forEach(s=>s.blocks.forEach(b=>{if(b.kind==='text')b.text=replace(b.text);else if(b.kind==='list')b.items=b.items.map(replace);else if(b.kind==='table')b.rows=b.rows.map(r=>r.map(replace));}));
    entries.push(`[${id}] ${source}`);
  }
  if(entries.length)sections.splice(sections.findIndex(s=>s.id==='sources'),0,{id:'data-notes',title:'Sumber data pengguna',blocks:[text('Penanda D merujuk ke sumber atau catatan yang dipakai berulang. Teks lengkap disertakan sekali di sini.'),...entries.map(text)]});
  if(!includeSources){
    const clean=(v:string)=>v.replace(/\[(?:J-|STD-|CLAIM-|GUIDE-|METHOD-|REPORT-|STUDY-)[^\]]*\]/g,'').replace(/https?:\/\/[^\s]+/g,'').trim();
    sections.forEach(s=>s.blocks.forEach(b=>{if(b.kind==='text')b.text=clean(b.text);else if(b.kind==='list')b.items=b.items.map(clean);else if(b.kind==='table')b.rows=b.rows.map(r=>r.map(clean));}));
  }
  const output = detail==='summary' ? compactSections(sections,p,plan,sid,unavailableAlternative ? null : evaluation,includeSources,value) : sections;
  output.forEach(s=>s.blocks.forEach(b=>{if(b.kind==='text')b.text=humanReportText(b.text);else if(b.kind==='list')b.items=b.items.map(humanReportText);else if(b.kind==='table')b.rows=b.rows.map(row=>row.map(humanReportText));else b.caption=humanReportText(b.caption);}));
  // Preserve the approved printed identity; decision staleness uses fingerprint above.
  return { version: 1, includeSources, detail, projectId: p.id, revision: p.revision, inputFingerprint: legacyPlanningFingerprint(p), title: p.name, updatedAt: p.updatedAt, mode: p.mode, state, status, scenarioId: sid, scenarioName: scenario?.name ?? 'Hujan belum dinyatakan', planName: plan.name, metrics: balance ? { baseline: balance.baseline, residual: balance.residual, stored: balance.stored, reused: balance.reused, infiltrated: balance.infiltrated, cost: balance.cost, area: balance.area } : null, recommendation, sections:output };
}

function humanReportText(v:string):string {
  return v.replace(/\bUNKNOWN\b/g,'belum diketahui').replace(/\buser_supplied\b/g,'dinyatakan pengguna').replace(/\buser-entered\b/g,'dinyatakan pengguna').replace(/\bliterature-guided\b/g,'berdasarkan referensi').replace(/\bmeasured\b/g,'pengukuran lapangan');
}
function compactSections(sections:ReportSection[],p:ProjectV2,plan:ReturnType<typeof snapshotPlan>,sid:string,evaluation:ReturnType<typeof evaluatePlan>|null,includeSources:boolean,value:(r:ReferenceV2,scenario?:string,values?:ParameterV2[])=>string):ReportSection[] {
  const get=(id:string)=>sections.find(s=>s.id===id)!;
  const components=plan.components.filter(c=>c.enabled);
  const baseline=productionBaseline(p,sid);
  const parcel=get('parcel');
  const parcelBlocks:ReportBlock[]=parcel.blocks.filter(b=>b.kind==='text' || b.kind==='figure' && b.svg.includes('<polygon'));
  const zoneTable=parcel.blocks.find(b=>b.kind==='table');
  if(zoneTable?.kind==='table')parcelBlocks.push(zoneTable);
  const planTable=get('plan').blocks.find(b=>b.kind==='table');
  const material=new Set<string>();
  if(evaluation && !evaluation.ok)evaluation.issues.forEach(i=>material.add(i.message));
  const conditions=new Map<string,string[]>();
  for(const [i,c] of components.entries()){const f=assessIntervention(p,c,sid,plan.parameters,plan.scientificEvidence?.[c.id]);for(const finding of [...f.reasons,...f.missing,...f.conditions]){const names=conditions.get(finding.message)??[];names.push(components.length>4 ? `I${i+1}` : c.name);conditions.set(finding.message,names);}}
  if(p.mode==='demo')material.add('Angka pada proyek ini adalah contoh sintetis, bukan pengukuran lokasi.');
  else if([...p.parameters,...plan.parameters].some(v=>v.evidence==='ASSUMPTION'))material.add('Sebagian angka merupakan perkiraan pengguna. Hasil perlu ditinjau kembali jika angka lapangan berbeda.');
  if(!baseline.ok)baseline.issues.forEach(i=>material.add(i.message));
  if(p.zones.some(z=>['ponding','concentrated-runoff'].includes(p.science?.surfaces[z.id]?.fieldObservation?.condition ?? 'unknown')))material.add(fieldObservationLimitation);
  if(!components.length)material.add('Paket ini tanpa penanganan. Volume sisa sama dengan kondisi awal bila hasil dapat dihitung.');
  const conditionGroups=new Map<string,string[]>();
  for(const [message,names] of conditions){const group=names.length===components.length ? 'Paket' : names.join(' + ');const messages=conditionGroups.get(group)??[];messages.push(message);conditionGroups.set(group,messages);}
  for(const [group,messages] of conditionGroups)material.add(`${group}: ${messages.join(' ')}`);
  const rain=get('rain').blocks.find(b=>b.kind==='table');
  const rainTable=rain?.kind==='table' ? table(['Skenario','Hujan','Limpasan awal','Sisa rencana'],rain.rows.map((row,i)=>[p.scenarios[i]!.name,value(p.scenarios[i]!.rainfall,p.scenarios[i]!.id,p.parameters),row[2]!,row[3]!])) : null;
  const verification:ReportSection={id:'verification',title:'Asumsi penting dan pemeriksaan berikutnya',blocks:[...(components.length>4 ? [text('Penanda I merujuk ke penanganan pada tabel paket. Pemeriksaan yang sama berlaku pada semua penanganan yang dicantumkan.')] : []),list([...material]),...(material.size ? [] : [text('Verifikasi sambungan, luapan, pemasangan dan kapasitas di lokasi sebelum penerapan.')])]};
  return [get('summary'),{...parcel,blocks:parcelBlocks},{id:'plan',title:components.length ? 'Penanganan dalam paket' : 'Paket tanpa intervensi',blocks:[...(planTable ? [planTable] : []),...components.flatMap(c=>c.planningNotes ? [text(`${c.name}: ${c.planningNotes}`)] : [])]}, {id:'rain',title:'Hasil pada skenario hujan',blocks:rainTable ? [rainTable] : [text('Hujan belum diisi; lengkapi kedalaman hujan untuk menghitung limpasan.')]},...sections.filter(s=>s.id==='comparison'),verification,...(includeSources ? sections.filter(s=>s.id==='provenance'||s.id==='data-notes'||s.id==='sources') : [])];
}
