import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import { fmt, type Evaluation } from "./productionBridge";
import { Parcel, materials } from "./Parcel";
import { CalculationSource } from "./CalculationSource";
import { HelpButton } from "./TirtaHelp";

export function RainVolumeDiagram({ result }: { result: Evaluation }) {
  const { rainfallM3: total, runoffM3: runoff, nonRunoffM3: other } = result.baseline;
  const [active, setActive] = useState<"runoff" | "other">("runoff");
  const id = useId().replace(/:/g, "");
  const fraction = total > 0 ? runoff / total : 0;
  const split = 46 + 190 * fraction;
  const upper = 240 * fraction;
  const lower = 240 * (1 - fraction);
  // Thin bands keep their true proportion; move their readings outside instead of widening them.
  const external = total === 0 || fraction < .55 || fraction > .65;
  return <div className="rain-volume-diagram rain-split">
    <div className={`volume-plot ${external ? "external-readings" : ""}`}>
    <div className="volume-ribbons">
    <svg className="volume-chart" viewBox="0 0 600 285" role="img" aria-label={`Air hujan di persil: ${fmt(total)} m³; limpasan awal: ${fmt(runoff)} m³; non-limpasan: ${fmt(other)} m³`}>
      <defs>
        <linearGradient id={`${id}-rain`}><stop stopColor="#a0d4f1"/><stop offset="1" stopColor="#c2e8fa"/></linearGradient>
        <linearGradient id={`${id}-runoff`}><stop stopColor="#60bafb"/><stop offset=".55" stopColor="#268bd1"/><stop offset="1" stopColor="#268bd1"/></linearGradient>
        <linearGradient id={`${id}-other`}><stop stopColor="#94d6c8"/><stop offset="1" stopColor="#a6dbca"/></linearGradient>
      </defs>
      {total > 0 ? <>
        <path d={`M150 46H184C282 46 281 0 385 0H600V${upper}H385C281 ${upper} 282 ${split} 184 ${split}H150Z`} fill={`url(#${id}-runoff)`}/>
        <path d={`M150 ${split}H184C282 ${split} 281 ${285 - lower} 385 ${285 - lower}H600V285H385C281 285 282 236 184 236H150Z`} fill={`url(#${id}-other)`}/>
        <rect x="0" y="46" width="150" height="190" rx="11" fill={`url(#${id}-rain)`} stroke="#eaf8ff" strokeWidth="1.5"/>
        <path d="M150 46V236" stroke="#eaf8ff" strokeWidth="1.5"/>
      </> : <rect x="0" y="46" width="600" height="190" rx="11" fill="#d8edf5" />}
    </svg>
    <div className="volume-origin-label"><span>{total > 0 ? "100%" : "0%"}</span><small>Air hujan<br/>di persil</small><strong>{fmt(total)} <small>m³</small></strong></div>
    </div>
    <div className="volume-outcomes" style={{ "--runoff-height": `${upper / 285 * 100}%`, "--other-height": `${lower / 285 * 100}%` } as React.CSSProperties}>
      <button className="runoff-reading" aria-pressed={active === "runoff"} onClick={() => setActive("runoff")}><small>{total > 0 ? `${fmt(fraction * 100)}%` : "0%"}</small><span>Limpasan awal</span><strong>{fmt(runoff)} <small>m³</small></strong></button>
      <button className="other-reading" aria-label="Bagian non-limpasan" aria-pressed={active === "other"} onClick={() => setActive("other")}><small>{total > 0 ? `${fmt((1 - fraction) * 100)}%` : "0%"}</small><span>Non-limpasan</span><strong>{fmt(other)} <small>m³</small></strong></button>
    </div>
    </div>
  </div>;
}

export function RainWorkspace({ project, result, selected, onSelect, editor, missing, next, sources }: {
  project: ProjectV2; result: Evaluation | null; selected: string; onSelect: (id: string) => void;
  editor: ReactNode; missing: ReactNode; next: ReactNode; sources: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const motionRoot = useRef<HTMLDivElement>(null);
  const previousSignature = useRef<string | null>(null);
  const motionFrame = useRef<number | null>(null);
  const motionTimer = useRef<number | null>(null);
  const zones = [...(result?.baseline.zones ?? [])].sort((a, b) => b.runoffM3 - a.runoffM3);
  const shown = zones.filter(r => project.zones.find(z => z.id === r.id)?.name.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")));
  const max = Math.max(0, ...zones.map(z => z.runoffM3));
  const resultSignature = result ? [result.baseline.rainfallM3,result.baseline.runoffM3,result.baseline.nonRunoffM3,...result.baseline.zones.map(z=>`${z.id}:${z.runoffM3}`)].join('|') : 'missing';
  useLayoutEffect(() => {
    const previous = previousSignature.current;
    previousSignature.current = resultSignature;
    if (previous == null || previous === resultSignature || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = motionRoot.current;
    if (!root) return;
    root.classList.remove('is-data-settling');
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    motionFrame.current = requestAnimationFrame(() => {
      root.classList.add('is-data-settling');
      motionTimer.current = window.setTimeout(() => root.classList.remove('is-data-settling'), 260);
    });
  }, [resultSignature]);
  return <div ref={motionRoot} className="rain-atlas">
    <div className="rain-top-composition">
      <section className="rain-input rain-dock" aria-label="Pengaturan hujan">
        <h2>Hujan yang diuji</h2><p>Masukkan tinggi hujan untuk melihat air yang jatuh di persil Anda.</p>
        {editor}<div className="rain-next-inline">{next}</div>
      </section>
      <section className="rain-analysis" aria-label="Hasil hujan">
        {result ? <><section className="rain-equation"><h2>Air hujan di persil</h2><span>{fmt(result.baseline.zones.reduce((sum, z) => sum + z.areaM2, 0))} m² × {fmt(result.baseline.rainfallMm)} mm / 1.000 = {fmt(result.baseline.rainfallM3)} m³ <HelpButton topic="rainfall" label="Cara hitung"/></span><p>1 mm hujan di 1 m² = 1 liter. Dibagi 1.000 untuk mengubah liter menjadi m³.</p></section><RainVolumeDiagram result={result}/><CalculationSource method="rainfall"/></> : missing}
      </section>
      <aside className="rain-parcel-context"><span className="parcel-context-label">Sketsa persil · {result ? `${fmt(result.baseline.zones.reduce((sum,z)=>sum+z.areaM2,0))} m²` : project.parcel ? "luas dari input Anda" : "belum dibuat"}</span><Parcel project={project} selected={selected} onSelect={onSelect} compact fit materialTextures detailLabels /></aside>
    </div>
    {result && <section className="rain-contribution-region" aria-label="Kontribusi zona">
      <header><div><h2>Dari zona mana limpasan berasal?</h2><p>Kontribusi tiap zona · total {fmt(result.baseline.runoffM3)} m³. Pilih baris untuk melihat zonanya.</p></div><HelpButton topic="coefficient" label="Dasar perhitungan"/></header>
      {zones.length > 8 && <label className="contribution-search">Cari zona<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>}
      <div className="contribution-list">{shown.map(r => {
        const zone = project.zones.find(z => z.id === r.id)!;
        return <button key={r.id} className={selected === r.id ? "selected" : ""} aria-pressed={selected === r.id} onClick={() => onSelect(r.id)}>
          <span className="zone-id" style={{color:materials[zone.surface ?? "soil"].ink}}>{project.zones.indexOf(zone)+1}</span><span className="contribution-name">{zone.name}<small>{fmt(r.areaM2)} m² · Koefisien limpasan: {fmt(r.coefficient)}</small></span>
          <span className="contribution-track"><span style={{width:`${max ? r.runoffM3 / max * 100 : 0}%`,backgroundImage:zone.surface ? `url(/materials/${zone.surface}.webp)` : undefined,backgroundColor:materials[zone.surface ?? "soil"].color}}/></span><strong>{fmt(r.runoffM3)} <small>m³</small><span>{result.baseline.runoffM3 ? `(${fmt(r.runoffM3 / result.baseline.runoffM3 * 100)}%)` : "(0%)"}</span></strong>
        </button>;
      })}</div>
      {!shown.length && <p>Tidak ada zona yang cocok dengan pencarian ini.</p>}
      <div className="contribution-scale" aria-hidden="true"><span>0</span><span>{fmt(max / 2)}</span><span>{fmt(max)} m³ · volume per zona</span></div>
      <CalculationSource method="runoff"/><footer>{sources}{next}</footer>
    </section>}
    {!result && <div className="screen-footer">{sources}{next}</div>}
  </div>;
}
