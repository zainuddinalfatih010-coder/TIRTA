import type { ProjectV2 } from "./projectV2";
import { productionBaseline } from "./productionBaseline";
import { dominates, evaluatePlan, familyLabels, type Alternative, type Plan } from "./planningEngine";
import { readInput } from "./planningAuthoring";
import { referencedParameters } from "./parameterReferences";
import { snapshotPlan } from "./planningEngine";
import { projectV2Schema } from "./projectV2";
import { assessPackage, waterUses } from "./packageRecommendations";
import type { ComponentVariant } from "./intervention-contract";
import { assessIntervention } from "./feasibility";

const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
const rupiah = (value: number) => `Rp${number(value)}`;
export const interventionReferences = {
  storage: { name: "EPA · Rainwater Harvesting Practices", url: "https://www.epa.gov/system/files/documents/2022-04/green-infrastructure-toolbox_rainwater-harvesting.pdf" },
  infiltration: { name: "Padlan & Fajriani (2025) · sumur resapan dan pemanenan hujan", url: "https://journal.uny.ac.id/publications/center/article/view/2048" },
  "rain-garden": { name: "EPA · Bioretention (Rain Gardens)", url: "https://www.epa.gov/system/files/documents/2021-11/bmp-bioretention-rain-gardens.pdf" },
  permeable: { name: "USGS · Selbig & Buer (2018)", url: "https://pubs.usgs.gov/publication/sir20185037" },
} as const;
export const bioporiReference = { name: "Sari, Qomariyah & Sobriyah (2014) · infiltrasi dan limpasan dengan biopori", url: "https://jurnal.uns.ac.id/matriks/article/view/37416" };
export function componentReference(c: ComponentVariant) {
  return c.family === "infiltration" && c.infiltrationType === "biopori" ? bioporiReference : interventionReferences[c.family];
}
export function componentResearch(c: ComponentVariant) {
  if (c.family === "storage" || (c.family === "infiltration" && c.infiltrationType !== "biopori")) return { ...interventionReferences.infiltration, relevance: "Studi bangunan pendidikan UNY menggabungkan pemanenan hujan, kebutuhan nonkonsumsi dan sumur resapan. Data hujan, kebutuhan air dan uji tanah berbeda dari MA Permata; tidak dipakai sebagai parameter otomatis." };
  if (c.family === "infiltration") return { ...bioporiReference, relevance: "Eksperimen laboratorium biopori pada tanah lanau berpasir dengan variasi hujan dan jumlah lubang. Mendukung pilihan praktik, bukan kapasitas universal per lubang atau bukti penanganan genangan di sekolah." };
  if (c.family === "rain-garden") return { name: "Barid & Lestari · Media Komunikasi Teknik Sipil 20(1), DOI 10.14710/mkts.v20i1.9244", url: "https://ejournal.undip.ac.id/index.php/mkts/article/view/9244", relevance: "Eksperimen Indonesia membandingkan media tanah bertanaman dan tanah kosong pada kondisi jenuh / tidak jenuh. Mendukung eksplorasi taman hujan; debit dan kekeruhannya tidak dikonversi menjadi kapasitas persil Anda." };
  return { ...interventionReferences.permeable, relevance: "Penelitian primer USGS pada perkerasan berpori buatan. Tidak mewakili pori tanah alami atau otomatis membuktikan performa MA Permata." };
}

export function planComposition(plan: Plan) {
  return plan.components.filter(c => c.enabled).map(c => c.name).join(" + ") || "Tanpa intervensi";
}

export function dominanceExplanation(candidate: Alternative, by: Alternative) {
  if (!dominates(by.balance, candidate.balance)) return null;
  const a = candidate.balance, b = by.balance;
  const differences = [
    a.cost > b.cost ? `biaya lebih rendah ${rupiah(a.cost - b.cost)}` : "biaya sama",
    a.area > b.area ? `lahan lebih sedikit ${number(a.area - b.area)} m²` : "lahan sama",
    a.residual > b.residual ? `sisa limpasan lebih sedikit ${number(a.residual - b.residual)} m³` : "sisa limpasan sama",
  ];
  return `${planComposition(by.plan)} memiliki ${differences.join(", ")}. Karena tidak lebih buruk pada ketiga ukuran, ${planComposition(candidate.plan)} tersisih pada hujan ini. Perbandingan memakai angka sebelum pembulatan.`;
}

export function alternativeAdvantages(candidate: Alternative, alternatives: readonly Alternative[]) {
  const peers = alternatives.filter(a => a.plan.id !== candidate.plan.id);
  if (!peers.length) return ["Satu-satunya pilihan yang tersedia dari ruang opsi ini; bukan bukti pilihan terbaik secara umum."];
  const labels = (["cost", "area", "residual"] as const).flatMap(key => {
    const labels = { cost: "Biaya paling rendah", area: "Pemakaian lahan paling sedikit", residual: "Sisa limpasan paling rendah" };
    return candidate.balance[key] <= Math.min(...peers.map(a => a.balance[key])) ? [labels[key] + " di antara pilihan yang ditampilkan"] : [];
  });
  return labels.length ? labels : ["Pilihan kompromi: tidak ada pilihan lain yang sekaligus lebih murah, lebih hemat lahan, dan menyisakan limpasan lebih sedikit."];
}

export function comparisonExplanation(chosen: Alternative, other: Alternative) {
  const relative = (a: number, b: number, unit: string, format = number) => a === b ? `${unit} sama` : `${unit} ${a < b ? "lebih rendah" : "lebih tinggi"} ${format(Math.abs(a - b))}`;
  return `Dibanding ${other.plan.name} (${planComposition(other.plan)}): ${relative(chosen.balance.cost, other.balance.cost, "biaya", rupiah)}, ${relative(chosen.balance.area, other.balance.area, "lahan", v => `${number(v)} m²`)}, ${relative(chosen.balance.residual, other.balance.residual, "sisa limpasan", v => `${number(v)} m³`)}. Berlaku pada hujan aktif.`;
}

export function interventionAdvice(project: ProjectV2, scenarioId: string) {
  const baseline = productionBaseline(project, scenarioId);
  if (!baseline.ok) return { ready: false as const, message: "Lengkapi persil, koefisien, dan hujan agar saran bisa dikaitkan dengan kontribusi zona.", items: [] };
  const contributions = [...baseline.value.zones].sort((a, b) => b.runoffM3 - a.runoffM3 || a.id.localeCompare(b.id));
  const items = contributions.filter(c => c.runoffM3 > 0).map(c => {
    const zone = project.zones.find(z => z.id === c.id)!;
    const choices = zone.surface === "roof" ? ["storage", "infiltration", "rain-garden"] as const
      : zone.surface === "paved" ? ["rain-garden", "infiltration"] as const
      : ["infiltration", "rain-garden"] as const;
    const condition = zone.surface === "roof"
      ? "Tangki bisa dicoba bila air atap dapat disalurkan dan ada rencana pemanfaatannya. Resapan atau taman hujan memerlukan tanah dan ruang yang sesuai."
      : zone.surface === "paved"
        ? "Perubahan permukaan dapat dicoba jika fungsi lahan memungkinkan. Taman hujan atau resapan memerlukan ruang serta penyaluran air yang dinyatakan."
        : zone.surface === "vegetation"
          ? "Vegetasi yang ada sudah masuk baseline. Menambah tanaman tidak otomatis memberi kapasitas baru; rain garden memerlukan media, penyaluran, dan kapasitas infiltrasi yang dibuktikan."
          : zone.surface === "porous"
            ? "Zona ini sudah berpori; jangan menghitung penggantian berpori sekali lagi. Periksa jenis bahan dan pemeliharaan sebelum menilai resapan tambahan."
            : "Resapan dapat dieksplorasi setelah kondisi tanah diuji. Tanah terbuka tidak otomatis cocok untuk sumur resapan atau taman hujan.";
    const conflicts = (component: ProjectV2['components'][number]) => assessIntervention(project,component,scenarioId,project.parameters,undefined,false,[component]).reasons;
    const blocked = choices.flatMap(family => project.components.filter(component => component.family === family && component.targets.includes(zone.id)).flatMap(component=>conflicts(component).map(finding=>finding.message)));
    const availableChoices = choices.filter(family => !project.components.some(component => component.family === family && component.targets.includes(zone.id) && conflicts(component).length));
    return { zoneId: zone.id, zoneName: zone.name, runoff: c.runoffM3, share: c.runoffM3 / baseline.value.runoffM3, choices: availableChoices, condition, blocked };
  });
  return { ready: true as const, message: baseline.value.runoffM3 === 0 ? "Pada hujan ini tidak ada limpasan awal. Tidak ada kebutuhan penanganan volume yang dapat disimpulkan dari skenario ini." : `Mulai dari kontribusi terbesar pada ${number(baseline.value.rainfallMm)} mm. Ini saran untuk dieksplorasi, bukan kelayakan konstruksi.`, items };
}

export function operationalGuidance(family: keyof typeof familyLabels) {
  const text = {
    storage: "Tentukan untuk apa air digunakan setelah hujan dan bagaimana ruang tampung tersedia lagi. Periksa saringan, penutup, sambungan, dan jalur kelebihan air. Air tampungan tidak otomatis layak diminum. Penggunaan setelah hujan tidak menambah kredit penanganan pada kejadian yang sama.",
    infiltration: "Periksa infiltrasi tanah, kondisi muka air tanah, ruang, dan penyaluran sebelum menentukan kapasitas. Biopori dan sumur resapan memiliki dasar kapasitas berbeda; volume tidak berasal otomatis dari jumlah atau ukuran lubang.",
    "rain-garden": "Vegetasi biasa bukan rain garden. Rencanakan media, tanaman sesuai lokasi, masuk/keluar air, dan pemeliharaan. TIRTA menghitung infiltrasi kejadian yang Anda nyatakan; penyaringan, drainase bawah, dan evapotranspirasi belum dimodelkan.",
    permeable: "Nyatakan bahan: paving berpori, celah paving, atau bahan lain beserta dasar kapasitasnya. Tanah alami dan perkerasan berpori bukan bahan yang sama. Periksa beban penggunaan, lapisan bawah, dan risiko penyumbatan; tidak ada koefisien atau kapasitas otomatis.",
  };
  return text[family];
}

export function decisionPackage(project: ProjectV2, plan: Plan, scenarioId: string) {
  const result = evaluatePlan(project, plan, scenarioId);
  if (!result.ok) return { ok: false as const, reasons: result.issues.map(i => i.message) };
  const b = result.value;
  const baseline = productionBaseline(project, scenarioId);
  const rain = baseline.ok ? baseline.value.rainfallMm : null;
  const handled = b.baseline - b.residual;
  const summary = `${planComposition(plan)} pada ${rain === null ? "hujan aktif" : `${number(rain)} mm`} menangani ${number(handled)} dari ${number(b.baseline)} m³ limpasan awal${b.baseline > 0 ? ` (${number(handled / b.baseline * 100)}%)` : "; persentase tidak dihitung karena baseline nol"}. Sisa ${number(b.residual)} m³. Biaya ${rupiah(b.cost)}, lahan ${number(b.area)} m²; memenuhi batas yang dinyatakan untuk skenario ini.`;
  const scenarioResults = project.scenarios.map(s => {
    const outcome = evaluatePlan(project, plan, s.id);
    const baseline = productionBaseline(project, s.id);
    return { id: s.id, name: s.name, rain: baseline.ok ? baseline.value.rainfallMm : null, outcome };
  });
  const available = scenarioResults.filter(s => s.outcome.ok);
  const robustness = project.scenarios.length < 2
    ? "Baru satu skenario hujan diuji. Tambahkan skenario lebih berat untuk membandingkan; ketahanan lintas hujan belum dapat disimpulkan."
    : available.length !== scenarioResults.length
      ? `${available.length} dari ${scenarioResults.length} skenario dapat dievaluasi. Lengkapi data atau periksa batas pada skenario yang belum lolos sebelum menyimpulkan ketahanan rencana.`
      : `Rencana dapat dievaluasi pada seluruh ${available.length} skenario yang dinyatakan. Ini bukan jaminan untuk hujan di luar skenario tersebut atau bukti tidak terjadi genangan.`;
  const tradeoffs = b.residual > 0 ? [`Masih ada ${number(b.residual)} m³ limpasan pada hujan ini; jalur kelebihan air perlu direncanakan secara teknis.`] : ["Sisa volume nol pada model kejadian ini bukan sertifikasi bebas banjir."];
  const checks: string[] = [];
  for (const zone of project.zones.filter(z => z.surface === "porous")) {
    if (zone.poreType === "natural") checks.push(`${zone.name}: pori tanah alami menurut pengguna. Penelitian perkerasan berpori buatan tidak langsung mewakili zona ini; periksa dasar koefisien dan tanah setempat.`);
    else if (zone.poreType === "manufactured") checks.push(`${zone.name}: pori / celah material buatan menurut pengguna. Jenis bahan, lapisan bawah dan pemeliharaan memengaruhi kesesuaian referensi.`);
    else checks.push(`${zone.name}: asal pori / celah permukaan belum diketahui.`);
    checks.push(zone.surfaceContext?.trim() ? `${zone.name} — jenis permukaan menurut pengguna: ${zone.surfaceContext}` : `${zone.name}: jenis bahan berpori belum dicatat; periksa apakah tanah alami, paving bercelah, atau material lain saat meninjau sumber koefisien.`);
  }
  for (const component of plan.components.filter(c => c.enabled)) {
    if (component.family === "storage") checks.push(`${component.name} — setelah hujan: ${waterUses[component.waterUse ?? "unknown"]}. ${component.drawdown === "planned" ? "Pengguna merencanakan penyiapan ulang ruang tampung sebelum hujan berikutnya." : component.drawdown === "unavailable" ? "Belum tersedia pengosongan; tangki penuh tidak memiliki ruang tampung yang sama pada hujan berikutnya." : "Cara menyiapkan ruang tampung kembali belum diputuskan."}`);
    if (component.family === "infiltration" && component.infiltrationType === "biopori") checks.push(`${component.name}: lubang resapan biopori; kapasitas berasal dari input kejadian, bukan jumlah atau ukuran lubang. Periksa jenis tanah, pemeliharaan bahan organik dan akses, serta hindari utilitas bawah tanah.`);
    if (component.family === "rain-garden") checks.push(`${component.name}: ${component.plantingPlan === "adapted" ? "pengguna merencanakan vegetasi sesuai kondisi basah–kering dan media lokasi" : component.plantingPlan === "existing" ? "pengguna ingin mengadaptasi vegetasi yang ada; kapasitas tambahannya tetap harus dibuktikan" : "jenis vegetasi dan media belum dipilih"}.`);
    checks.push(`${component.name}: ${operationalGuidance(component.family)}`);
    if (!component.planningNotes?.trim()) {
      if (component.family === "storage" && component.waterUse && component.waterUse !== "unknown" && component.drawdown === "planned") checks.push(`${component.name}: rencana penggunaan dan penyiapan ulang sudah dinyatakan; jadwal serta penanggung jawab pemeliharaan perlu ditentukan sebelum penerapan.`);
      else if (component.family === "infiltration" && component.infiltrationType === "biopori") checks.push(`${component.name}: jenis resapan sudah dipilih; jadwal dan penanggung jawab pemeliharaan belum dicatat.`);
      else checks.push(`${component.name}: rencana penggunaan / jenis konstruksi dan pemeliharaan belum dicatat.`);
    }
    else checks.push(`${component.name} — catatan pengguna: ${component.planningNotes}`);
    const treatment = b.components.find(c => c.id === component.id);
    const perf = component.performanceByScenario[scenarioId];
    const ref = perf && ("availableStorage" in perf ? perf.availableStorage : "infiltrationCapacity" in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
    const capacity = readInput({ ...project, parameters: [...project.parameters.filter(p => !plan.parameters.some(saved => saved.id === p.id)), ...plan.parameters] }, ref, scenarioId);
    if (treatment?.handled === 0) tradeoffs.push(`${component.name} tidak menangani volume pada skenario ini, tetapi biaya dan lahannya tetap dihitung. Tinjau target dan pilihan lain.`);
    if (treatment && capacity.text && treatment.handled < Number(capacity.text)) tradeoffs.push(`${component.name} menangani ${number(treatment.handled)} m³, lebih kecil dari kapasitas ${number(Number(capacity.text))} m³. Air target yang tersedia, bagian lahan yang diperlakukan, dan pembagian dengan intervensi lain membatasi manfaat; kapasitas lebih besar belum tentu membantu.`);
  }
  const activeAssumptions = referencedParameters([...project.parameters.filter(p => !plan.parameters.some(saved => saved.id === p.id)), ...plan.parameters], { parcel: project.parcel, zones: project.zones, scenario: project.scenarios.find(s => s.id === scenarioId), constraints: project.constraints, components: plan.components }).filter(p => p.value !== null && (p.evidence === "ASSUMPTION" || p.evidence === "DEMO"));
  return { ok: true as const, summary, tradeoffs, checks, robustness, scenarioResults, assessment: assessPackage(project, plan, scenarioId), provisional: activeAssumptions.length > 0, composition: planComposition(plan) };
}

export function saveDeclaredVariant(project: ProjectV2, scenarioId: string, name: string, id: string): ProjectV2 {
  if (!name.trim()) throw new Error("Beri nama varian rencana, misalnya Tangki ukuran kecil.");
  if (project.manualPlans.length >= 12) throw new Error("Maksimal 12 varian tersimpan. Hapus varian yang tidak diperlukan.");
  const plan = snapshotPlan(project, project.components.filter(c => c.enabled).map(c => c.id), id, name.trim());
  const result = evaluatePlan(project, plan, scenarioId);
  if (!result.ok) throw new Error(result.issues.map(i => i.message).join(" "));
  plan.optimizationScenarioId = scenarioId;
  return projectV2Schema.parse({ ...project, manualPlans: [...project.manualPlans, plan] });
}
