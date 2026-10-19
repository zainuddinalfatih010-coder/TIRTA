import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CloudRain, Search, MoreHorizontal } from "lucide-react";
import type { ProjectV2 } from "../domain/projectV2";
import { evaluatePlan, type Plan } from "../domain/planningEngine";
import { planComposition } from "../domain/decisionSupport";
import { fmt, money, limitsFromProject, type Evaluation } from "./productionBridge";
import { resourceLimitStatus } from "../domain/resourceLimits";
import { ProjectScenarioChart } from "./ScientificCharts";
import { PlanScreening } from "./PlanScreening";
import { ContextDialog } from "./ContextDialog";
import { CalculationSource } from "./CalculationSource";
import { InterventionIllustration } from "./Visuals";
import { HelpButton } from "./TirtaHelp";
import { comparisonTradeoffNote } from "./comparisonTradeoff";

type Candidate = { id: string; name: string; plan: Plan; result: Evaluation | null };
const colors = ["#006b94", "#0b765f", "#2456a4"];
const familyNames = { storage:"Tangki", infiltration:"Sumur / area resapan", "rain-garden":"Rain garden", permeable:"Permukaan berpori" };
const familyIcons = { storage:"tank", infiltration:"soak", "rain-garden":"garden", permeable:"porous" } as const;
const methodName = (c: Plan["components"][number]) => c.family === "infiltration" && c.infiltrationType === "biopori" ? "Biopori" : familyNames[c.family];
const methodIcon = (c: Plan["components"][number]) => c.family === "infiltration" && c.infiltrationType === "biopori" ? "biopori" as const : familyIcons[c.family];
const summary = (plan: Plan) => [...new Set(plan.components.filter(c => c.enabled).map(methodName))].join(" + ") || "Tanpa intervensi";
function PackageSymbols({ plan }: { plan: Plan }) {
  const families = [...new Set(plan.components.filter(c => c.enabled).map(methodIcon))];
  return <span className="compare-package-symbols" aria-hidden="true">{families.slice(0,2).map(family => <InterventionIllustration key={family} kind={family}/>)}</span>;
}

export function ComparisonWorkbench({ project, items, scenarioId, chosen, initialIds, onChoose, highlightPlanIds, onPinsChange, renderDetails, tools }: {
  project: ProjectV2; items: readonly Candidate[]; scenarioId: string; chosen: string | null;
  initialIds: readonly string[]; onChoose: (id: string) => void;
  highlightPlanIds?: readonly string[]; onPinsChange?: (ids: string[]) => void; renderDetails?: (id: string) => ReactNode;
  tools?: ReactNode;
}) {
  const [pins, setPins] = useState<string[]>(() => {
    const initial = initialIds.filter(id => items.some(item => item.id === id));
    return (initial.length ? initial : items.map(item => item.id)).slice(0, 3);
  });
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mobileId, setMobileId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"picker" | "chart" | "matrix">("chart");
  const search = useRef<HTMLInputElement>(null);
  const matrixHeading = useRef<HTMLHeadingElement>(null);
  const selected = pins.flatMap(id => { const item = items.find(item => item.id === id); return item ? [item] : []; });
  const matches = items.filter(item => `${item.name} ${planComposition(item.plan)}`.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")));
  const detail = items.find(item => item.id === detailId);
  const chartNames = selected.map(item => [...new Set(item.plan.components.filter(c => c.enabled).map(c => c.family === "infiltration" && c.infiltrationType === "biopori" ? "Biopori" : ({storage:"Tangki", infiltration:"Resapan", "rain-garden":"Rain garden", permeable:"Berpori"})[c.family]))].join(" + ") || "Tanpa intervensi");
  const chartPlans = selected.map((item,index) => ({ ...item, name:chartNames.filter(name => name === chartNames[index]).length === 1 ? chartNames[index]! : item.name }));
  // Presentation only: evaluate every declared scenario through the canonical engine.
  const results = useMemo(() => new Map(items.map(item => [item.id, project.scenarios.map(s => evaluatePlan(project, item.plan, s.id))])), [project, items]);
  const projectLimits = limitsFromProject(project);
  const maxCost = Math.max(1, ...selected.map(item => item.result?.cost ?? 0));
  const maxArea = Math.max(1, ...selected.map(item => item.result?.area ?? 0));
  const maxHandled = Math.max(1, ...selected.map(item => item.result ? item.result.retained + item.result.reused + item.result.infiltrated : 0));
  const tradeoffRows = selected.flatMap(item => item.result?.feasible ? [{ id:item.id, cost:item.result.cost, area:item.result.area, residual:item.result.residual }] : []);
  const changePins = (next: string[]) => { setPins(next); onPinsChange?.(next); };
  const toggle = (id: string) => changePins(pins.includes(id) ? pins.filter(pin => pin !== id) : pins.length < 3 ? [...pins, id] : pins);
  const reviewSelection = () => {
    setMobileView('matrix');
    requestAnimationFrame(() => {
      matrixHeading.current?.scrollIntoView({block:'start'});
      matrixHeading.current?.focus({preventScroll:true});
    });
  };

  return <div className="comparison-workbench" data-mobile-view={mobileView}>
    {tools && <div className="compare-mobile-tools">{tools}</div>}
    <div className="compare-mobile-view" aria-label="Tampilan perbandingan"><button aria-pressed={mobileView === "picker"} onClick={() => setMobileView("picker")}>Pilih paket</button><button aria-pressed={mobileView === "chart"} onClick={() => setMobileView("chart")}>Grafik hujan</button><button aria-pressed={mobileView === "matrix"} onClick={() => setMobileView("matrix")}>Angka & pilihan</button></div>
    <div className="comparison-top">
      <aside className="compare-navigator" aria-label="Paket untuk dibandingkan">
        <header><h2>{items.length} alternatif</h2><label className="compare-search"><Search size={16} aria-hidden="true"/><input ref={search} type="search" aria-label="Cari paket perbandingan" placeholder="Cari alternatif…" value={query} onChange={e => setQuery(e.target.value)}/></label></header>
        {[true, false].map(pinned => {
          const group = matches.filter(item => pins.includes(item.id) === pinned);
          if (pinned) group.sort((a,b) => pins.indexOf(a.id) - pins.indexOf(b.id));
          return <div className="compare-candidate-group" key={String(pinned)}>
            <h3>{pinned ? `Sedang dibandingkan (${group.length})` : `Alternatif lainnya (${group.length})`}</h3>
            <div className={pinned ? "compare-pinned-list" : "compare-candidate-list"} role="region" aria-label={pinned ? "Paket terpilih pada grafik" : "Daftar paket perbandingan"} tabIndex={pinned ? undefined : 0}>
              {group.map(item => <label key={item.id} className={`compare-candidate ${pinned ? "pinned" : ""} ${highlightPlanIds?.includes(item.plan.id) ? "most-effective" : ""}`}>
                <input type="checkbox" aria-label={`Bandingkan ${item.name}`} checked={pinned} disabled={!pinned && selected.length >= 3} onChange={() => toggle(item.id)}/>
                <PackageSymbols plan={item.plan}/><span><strong title={summary(item.plan)}>{pinned ? chartPlans.find(plan => plan.id === item.id)?.name : summary(item.plan)}</strong><small title={item.name}>{item.name}{chosen === item.id ? " · Rencana pilihan Anda" : ""}</small></span>
                <button type="button" className="text-button compare-candidate-detail" aria-label={`Lihat detail ${item.name}`} onClick={event => { event.preventDefault(); event.stopPropagation(); setDetailId(item.id); }}><MoreHorizontal size={18} aria-hidden="true"/></button>
              </label>)}
              {!group.length && <p className="compare-list-empty">{pinned ? "Belum ada paket dipilih." : "Tidak ada paket lain yang cocok."}</p>}
            </div>
          </div>;
        })}
        <div className="compare-navigator-footer"><small>Pilih hingga 3 paket untuk dibandingkan.</small><button className="text-button" onClick={() => changePins([])} disabled={!selected.length}>Kosongkan perbandingan</button></div>
        {selected.length>0 && <div className="compare-selection-next"><span>{selected.length} paket untuk dibandingkan; belum menjadi pilihan rencana.</span><button className="primary" onClick={reviewSelection}>Lihat angka & pilih rencana<ArrowRight size={16} aria-hidden="true"/></button></div>}
        {tools}
      </aside>
      {selected.length ? <ProjectScenarioChart project={project} plans={chartPlans} overlay /> : <div className="compare-no-pins"><h2>Paket mana yang ingin Anda bandingkan?</h2><p>Pilih hingga 3 paket dari daftar.</p></div>}
    </div>

    {selected.length > 0 && <section className="compare-matrix-section" aria-label="Perbandingan paket terpilih">
      <header><div><h2 ref={matrixHeading} tabIndex={-1}>Perbandingan paket terpilih</h2><p>Biaya dan volume pada hujan aktif; sisa limpasan di setiap skenario.</p></div><HelpButton topic="alternatives" compact label="Dasar perbandingan"/><button onClick={() => { setMobileView("picker"); requestAnimationFrame(() => { search.current?.scrollIntoView({ block: "center" }); search.current?.focus(); }); }}>+ Tambah paket</button></header>
      <div className="compare-mobile-switch" aria-label="Paket yang sedang dibaca">{selected.map(item => <button key={item.id} aria-pressed={(selected.find(p => p.id === mobileId) ?? selected[0])?.id === item.id} onClick={() => setMobileId(item.id)}>{item.name}</button>)}</div>
      <div className="compare-matrix-scroll" role="region" aria-label="Matriks perbandingan, geser untuk hujan lainnya" tabIndex={0}>
        <table className="compare-matrix">
          <caption className="sr-only">Perbandingan {selected.length} paket. Angka kosong berarti hasil belum tersedia, bukan nol.</caption>
          <thead><tr><th scope="col">Paket</th><th scope="col">Biaya (Rp)</th><th scope="col">Lahan (m²)</th><th scope="col">Tertangani (m³)<small>Hujan aktif</small></th>{project.scenarios.map(s => <th scope="col" key={s.id}><CloudRain size={15} aria-hidden="true"/> <span className="compare-rain-name" title={s.name}>{s.name}</span><small>Sisa limpasan (m³)</small></th>)}<th scope="col">Catatan singkat</th><th scope="col">Aksi</th></tr></thead>
          <tbody>{selected.map((item, index) => {
            const result = item.result;
            const handled = result ? result.retained + result.reused + result.infiltrated : null;
            const resourceStatus = result ? resourceLimitStatus({ cost: result.cost, area: result.area }, projectLimits) : null;
            const canChoose = !!result?.feasible && !!resourceStatus?.withinKnownLimits;
            const tradeoff = canChoose ? comparisonTradeoffNote(tradeoffRows,item.id) : null;
            return <tr key={item.id} className={`comparison-row ${chosen === item.id ? "chosen" : ""} ${(selected.find(p => p.id === mobileId) ?? selected[0])?.id === item.id ? "mobile-active" : ""}`}>
              <th scope="row"><div className="compare-package-identity"><PackageSymbols plan={item.plan}/><span><strong title={summary(item.plan)}>{summary(item.plan)}</strong><small title={item.name}>{item.name}{chosen === item.id ? " · Rencana pilihan Anda" : ""}</small></span><button className="text-button compare-detail-link" aria-label="Lihat data per hujan" title={`Data per hujan: ${item.name}`} onClick={() => setDetailId(item.id)}><MoreHorizontal size={18} aria-hidden="true"/></button></div></th>
              <td data-label="Biaya"><strong>{result ? money(result.cost) : "Belum tersedia"}</strong>{result && <div className="compare-meter" aria-hidden="true"><span style={{ width:`${result.cost / maxCost * 100}%` }}/></div>}</td>
              <td data-label="Lahan"><strong>{result ? `${fmt(result.area)} m²` : "Belum tersedia"}</strong>{result && <div className="compare-meter area" aria-hidden="true"><span style={{ width:`${result.area / maxArea * 100}%` }}/></div>}</td>
              <td data-label="Tertangani · hujan aktif"><strong>{handled !== null ? `${fmt(handled)} m³` : "Belum tersedia"}</strong>{handled !== null && <div className="compare-meter handled" aria-hidden="true"><span style={{ width:`${handled / maxHandled * 100}%` }}/></div>}</td>
              {project.scenarios.map((s, scenarioIndex) => {
                const evaluated = results.get(item.id)?.[scenarioIndex];
                return <td key={s.id} data-label={`Sisa limpasan · ${s.name}`} className="compare-residual"><strong style={{ color:colors[index] }}>{evaluated?.ok ? `${fmt(evaluated.value.residual)} m³` : "Belum tersedia"}</strong>{!evaluated?.ok && <small>Periksa data & kapasitas hujan ini</small>}</td>;
              })}
              <td className="compare-notes" data-label="Catatan singkat">{resourceStatus&&!resourceStatus.withinKnownLimits?<div className="compare-limit-note"><strong>Tidak memenuhi batas rencana</strong><span>{resourceStatus.budgetExceededBy!==null?`Biaya lebih tinggi ${money(resourceStatus.budgetExceededBy)}. `:""}{resourceStatus.landExceededBy!==null?`Lahan lebih tinggi ${fmt(resourceStatus.landExceededBy)} m².`:""}</span></div>:tradeoff&&<div className="compare-tradeoff-note"><strong>{tradeoff.headline}</strong><span>{tradeoff.detail}</span></div>}<PlanScreening project={project} plan={item.plan} scenarioId={scenarioId}/></td><td className="compare-actions" data-label="Aksi"><button className="primary" disabled={!canChoose} title={!canChoose&&resourceStatus&&!resourceStatus.withinKnownLimits?"Paket melampaui batas rencana. Ubah batas atau pilih paket lain.":undefined} onClick={() => onChoose(item.id)}>Pilih rencana ini<ArrowRight size={16}/></button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <CalculationSource method="ledger"/>
    </section>}
    <p className="quiet comparison-boundary sr-only">Perbandingan volume pada beberapa hujan, bukan prediksi kedalaman atau bahaya banjir.</p>
    {detail && <ContextDialog className="compare-rain-detail-dialog" title={`Data per hujan — ${detail.name}`} onClose={() => setDetailId(null)}>
      <p>{planComposition(detail.plan)}</p>
      {renderDetails?.(detail.id)}
      {project.scenarios.map((s, index) => {
        const evaluated = results.get(detail.id)?.[index];
        return <section key={s.id} className="compare-scenario-detail"><h3>{s.name}</h3>{evaluated?.ok ? <dl><div><dt>Ditampung</dt><dd>{fmt(evaluated.value.stored)} m³</dd></div><div><dt>Digunakan kembali</dt><dd>{fmt(evaluated.value.reused)} m³</dd></div><div><dt>Diinfiltrasikan</dt><dd>{fmt(evaluated.value.infiltrated)} m³</dd></div><div><dt>Sisa limpasan</dt><dd>{fmt(evaluated.value.residual)} m³</dd></div></dl> : <><strong>Hasil belum tersedia</strong><ul>{evaluated?.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul></>}<PlanScreening project={project} plan={detail.plan} scenarioId={s.id}/></section>;
      })}
    </ContextDialog>}
  </div>;
}
