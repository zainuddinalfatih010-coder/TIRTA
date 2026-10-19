import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import type { Plan } from "../domain/planningEngine";
import { fmt, money } from "./productionBridge";
import { chartMaximum, contiguousSegments, scenarioChartData, type ScenarioLabel, type ScenarioSeries } from "./ChartData";

const palette = ["#007eaa", "#8c573a", "#598041", "#785c99"];
const chartCost = (value: number) => value >= 1_000_000 ? money(value) : `Rp${fmt(value)}`;
function usePlotWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(620);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
function activate(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
}

export interface VolumePart { name: string; value: number; color: string; note: string }
export function VolumeChart({ total, parts, originLabel = "Limpasan awal", compactDetails = false }: { total: number; parts: readonly VolumePart[]; originLabel?: string; compactDetails?: boolean }) {
  const { ref, width } = usePlotWidth();
  const [active, setActive] = useState(0);
  const [inspected, setInspected] = useState(false);
  const inspect = (index: number) => { setActive(index); setInspected(true); };
  const part = parts[active] ?? parts[0];
  const left = 12, right = width - 12, length = right - left;
  const ratio = (value: number) => total > 0 ? value / total : 0;
  return <div className="scientific-chart volume-chart" ref={ref}>
    <svg viewBox={`0 0 ${width} 178`} role="img" aria-label={`${originLabel}: ${fmt(total)} m³. ${parts.map(p => `${p.name}: ${fmt(p.value)} m³`).join("; ")}`}>
      <text x={left} y={20} className="plot-label">{originLabel}</text>
      <text x={right} y={20} textAnchor="end" className="plot-value">{fmt(total)} m³</text>
      <rect x={left} y={33} width={length} height={22} rx={4} className="volume-reference" />
      <rect x={left} y={33} width={total > 0 ? length : 0} height={22} rx={4} fill="#8fcfe2" />
      {compactDetails && <path d={`M${width / 2} 62V81m-7-7 7 8 7-8`} fill="none" stroke="#45697c" strokeWidth={2} aria-hidden="true"/>}
      <path d={`M${left} 64V144M${right} 64V144`} className="plot-guide" />
      <text x={left} y={88} className="plot-label">Pembagian volume</text>
      <rect x={left} y={99} width={length} height={36} rx={4} className="volume-reference" />
      {parts.map((p, i) => {
        const x = left + ratio(parts.slice(0, i).reduce((sum, previous) => sum + previous.value, 0)) * length;
        return <rect key={p.name} x={x} y={99} width={ratio(p.value) * length} height={36} fill={p.color}
          opacity={active === i ? 1 : 0.65} onPointerEnter={() => setActive(i)} onClick={() => inspect(i)} />;
      })}
      {[0, 0.5, 1].map(f => <text key={f} x={left + f * length} y={164} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} className="plot-tick">{fmt(total * f)} m³</text>)}
    </svg>
    <div className="chart-legend volume-legend" aria-label="Rincian pembagian volume">
      {parts.map((p, i) => <button key={p.name} type="button" aria-pressed={active === i} onClick={() => inspect(i)}>
        <i style={{ background: p.color }} aria-hidden="true" /><span>{p.name}</span><strong>{fmt(p.value)} m³</strong>
      </button>)}
    </div>
    {part && (!compactDetails || inspected) && <p className="chart-reading"><strong>{part.name} · {fmt(part.value)} m³</strong><span>{part.note}</span></p>}
    {total === 0 && <p className="quiet">Volume kejadian ini nol. Tidak ada batang volume untuk ditampilkan.</p>}
  </div>;
}

export interface TradeoffPoint { id: string; name: string; cost: number; area: number; residual: number }
export function TradeoffChart({ points, onInspect, compact = false }: { points: readonly TradeoffPoint[]; onInspect: (id: string) => void; compact?:boolean }) {
  const { ref, width } = usePlotWidth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = points.find(p => p.id === activeId) ?? points[0];
  const maxX = chartMaximum(points.map(p => p.cost)), maxY = chartMaximum(points.map(p => p.residual));
  const left = 58, right = width - 25, top = 34, bottom = compact ? 201 : 251;
  const x = (n: number) => left + n / maxX * (right - left);
  const y = (n: number) => bottom - n / maxY * (bottom - top);
  const groups = points.reduce<TradeoffPoint[][]>((all, p) => {
    const group = all.find(g => g[0]?.cost === p.cost && g[0]?.residual === p.residual);
    if (group) group.push(p); else all.push([p]); return all;
  }, []);
  if (!points.length) return null;
  return <section className="analysis-region tradeoff-chart" aria-label="Grafik biaya dan sisa limpasan">
    <header className="analysis-heading"><div><span className="analysis-eyebrow">Paket dalam batas rencana</span><h2>Biaya dan sisa limpasan</h2></div><span>{points.length} alternatif</span></header>
    <p className="quiet">Pilih titik untuk melihat biaya, lahan, dan sisa limpasan paket.</p>
    <div className="scientific-chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${bottom + 61}`} role="group" aria-label="Plot alternatif, sumbu biaya dalam rupiah dan sisa limpasan dalam meter kubik">
        <text x={left} y={18} className="plot-label">Sisa limpasan (m³)</text>
        {[0, 0.5, 1].map(f => <g key={f}><path d={`M${left} ${y(maxY * f)}H${right}`} className="plot-grid" /><text x={left - 10} y={y(maxY * f) + 5} textAnchor="end" className="plot-tick">{fmt(maxY * f)}</text>
          <text x={x(maxX * f)} y={bottom + 25} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} className="plot-tick">{chartCost(maxX * f)}</text></g>)}
        <text x={right} y={bottom + 53} textAnchor="end" className="plot-label">Biaya total (Rp)</text>
        {groups.map(group => {
          const p = group[0]!;
          const selected = group.some(point => point.id === active?.id);
          const labelFits = groups.every(other => other === group || Math.hypot(x(other[0]!.cost) - x(p.cost), y(other[0]!.residual) - y(p.residual)) > 34);
          const choose = () => {
            const next = group[(group.findIndex(point => point.id === active?.id) + 1) % group.length]!;
            setActiveId(next.id);
          };
          return <g key={p.id} role="button" tabIndex={0} aria-label={group.map(point => `${point.name}, ${money(point.cost)}, ${fmt(point.residual)} m³, ${fmt(point.area)} m²`).join("; ")} aria-pressed={selected}
            className={`plot-point ${selected ? "active" : ""}`} onClick={choose} onKeyDown={e => activate(e, choose)}>
            <circle cx={x(p.cost)} cy={y(p.residual)} r={18} fill="transparent" />
            <circle cx={x(p.cost)} cy={y(p.residual)} r={selected ? 11 : 8} className="point-mark" />
            {(selected || labelFits) && <text x={x(p.cost)} y={y(p.residual) - 18} textAnchor="middle" className="plot-tick">{group.map(point => points.indexOf(point) + 1).join("·")}</text>}
          </g>;
        })}
      </svg>
    </div>
    <div className="chart-legend candidate-legend" aria-label="Pilih titik alternatif">
      {points.map((p, i) => <button key={p.id} aria-pressed={active?.id === p.id} onClick={() => setActiveId(p.id)}><span className="chart-number">{i + 1}</span><span>{p.name}</span></button>)}
    </div>
    {active && <div className="tradeoff-reading"><strong>{active.name}</strong><dl><div><dt>Biaya</dt><dd>{chartCost(active.cost)}</dd></div><div><dt>Lahan</dt><dd>{fmt(active.area)} m²</dd></div><div><dt>Sisa limpasan</dt><dd>{fmt(active.residual)} m³</dd></div></dl><button onClick={() => onInspect(active.id)}>Lihat isi & alasan paket →</button></div>}
  </section>;
}

export function ScenarioChart({ scenarios, series, baseline, overlay = false }: { scenarios: readonly ScenarioLabel[]; series: readonly ScenarioSeries[]; baseline: ScenarioSeries; overlay?: boolean }) {
  const { ref, width } = usePlotWidth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const active = series.find(s => s.id === activeId) ?? series[0];
  const selectedIndex = Math.max(0, scenarios.findIndex(s => s.id === scenarioId));
  const maximum = chartMaximum([...baseline.values, ...series.flatMap(s => s.values)]);
  const annotated = overlay && width >= 600 && scenarios.length > 1 && scenarios.length <= 4 && series.every(s => s.name.length <= 22) && [baseline, ...series].every(s => s.values.at(-1) != null);
  const left = 54, right = width - (annotated ? 210 : 22), top = 35, bottom = annotated ? 250 : 237;
  const firstX = annotated ? left + Math.min(130, (right - left) / 4) : left;
  const x = (i: number) => scenarios.length > 1 ? firstX + i / (scenarios.length - 1) * (right - firstX) : (firstX + right) / 2;
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const draws = [baseline, ...(overlay ? series : active ? [active] : [])];
  const seriesColor = (id: string) => overlay ? ["#008dc1", "#16856d", "#2456a4"][Math.max(0, series.findIndex(s => s.id === id)) % 3]! : palette[0]!;
  const seriesTextColor = (id:string) => overlay ? ["#006b94", "#0b765f", "#2456a4"][Math.max(0, series.findIndex(s => s.id === id)) % 3]! : palette[0]!;
  const scenario = scenarios[selectedIndex];
  // Separate annotations with leaders; the data points keep their exact positions.
  const labelsAt = (scenarioIndex: number) => {
    const labels = draws.flatMap((s, index) => s.values[scenarioIndex] == null ? [] : [{ s, index, value:s.values[scenarioIndex]!, position:y(s.values[scenarioIndex]!) }]).sort((a,b) => a.position - b.position);
    labels.forEach((label,index) => { label.position = Math.max(top + 12, label.position, index ? labels[index - 1]!.position + 30 : top); });
    for (let index = labels.length - 1; index >= 0; index--) labels[index]!.position = Math.min(labels[index]!.position, index === labels.length - 1 ? bottom - 8 : labels[index + 1]!.position - 30);
    return labels;
  };
  if (!scenarios.length || !series.length) return null;
  return <section className={`analysis-region scenario-chart ${annotated ? "annotated-scenario-chart" : ""}`} aria-label="Grafik lintas skenario hujan">
    <header className="analysis-heading"><div><span className="analysis-eyebrow">Perbandingan skenario hujan</span><h2>{overlay ? "Saat hujan bertambah" : "Sisa limpasan per skenario"}</h2></div><span>m³ / kejadian</span></header>
    {overlay && <p className="compare-chart-intro">Perbandingan sisa limpasan pada setiap skenario hujan.</p>}
    {!annotated && <div className="chart-legend candidate-legend" aria-label="Paket pada grafik skenario">{series.map((s, i) => <button key={s.id} aria-pressed={active?.id === s.id} onClick={() => setActiveId(s.id)}><span className="chart-number" style={overlay ? { borderColor:seriesColor(s.id), color:seriesColor(s.id) } : undefined}>{i + 1}</span><span>{s.name}</span></button>)}</div>}
    <div className="scientific-chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${annotated ? 312 : 289}`} role="group" aria-label="Sisa limpasan pada skenario yang dinyatakan, bukan kurva prediksi">
        <text x={left} y={18} className="plot-label">Sisa limpasan (m³)</text>
        {(overlay ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 0.5, 1]).map(f => <g key={f}><path d={`M${left} ${y(maximum * f)}H${right}`} className="plot-grid"/><text x={left - 10} y={y(maximum * f) + 5} textAnchor="end" className="plot-tick">{fmt(maximum * f)}</text></g>)}
        {draws.map((s, index) => <g key={`${index}:${s.id}`} data-series-id={s.id} data-series-active={index ? String(s.id === active?.id) : undefined} data-series-muted={index ? String(s.id !== active?.id) : undefined} opacity={overlay && index && s.id !== active?.id ? 0.34 : 1}>
          {contiguousSegments(s.values).map((segment, i) => <path key={i} d={segment.map((p, j) => `${j ? "L" : "M"}${x(p.index)} ${y(p.value)}`).join(" ")} fill="none" stroke={index ? seriesColor(s.id) : "#839ca8"} strokeWidth={index ? (s.id === active?.id ? 4.5 : 2.2) : 2} strokeDasharray={index ? undefined : "5 5"} />)}
          {s.values.map((value, i) => value !== null && <g key={scenarios[i]!.id} className={`plot-point ${selectedIndex === i ? "active" : ""}`} role="button" tabIndex={0}
            aria-label={`${s.name}, ${scenarios[i]!.name}, ${fmt(value)} m³`} onClick={() => setScenarioId(scenarios[i]!.id)} onKeyDown={e => activate(e, () => setScenarioId(scenarios[i]!.id))}>
            <circle cx={x(i)} cy={y(value)} r={17} fill="transparent" />
            <circle cx={x(i)} cy={y(value)} r={selectedIndex === i ? 6 : 4} fill={index ? seriesColor(s.id) : "#839ca8"} stroke="white" strokeWidth={2} />
          </g>)}
        </g>)}
        {annotated && <>
          {labelsAt(0).map(({s,index,value,position}) => <g key={`start-${s.id}`} aria-hidden="true"><path d={`M${x(0)-8} ${y(value)}L${x(0)-20} ${position}`} stroke={index ? seriesColor(s.id) : "#839ca8"} fill="none"/><text x={x(0)-26} y={position+5} textAnchor="end" className="plot-value" style={{ fill:index ? seriesTextColor(s.id) : "#607484" }}>{fmt(value)}</text></g>)}
          {labelsAt(scenarios.length - 1).map(({s,index,value,position}) => <g key={`end-${s.id}`}>
            <path d={`M${right+8} ${y(value)}L${right+64} ${position}`} stroke={index ? seriesColor(s.id) : "#839ca8"} fill="none"/>
            <text x={right+12} y={position-8} className="plot-value" style={{ fill:index ? seriesTextColor(s.id) : "#607484" }}>{fmt(value)}</text>
            <foreignObject x={right+74} y={position-14} width={130} height={28}>
              <div className="candidate-legend endpoint-label">{index ? <button title={s.name} aria-pressed={active?.id === s.id} style={{ color:seriesTextColor(s.id) }} onClick={() => setActiveId(s.id)}>{s.name}</button> : <span>Tanpa intervensi</span>}</div>
            </foreignObject>
          </g>)}
        </>}
        {scenarios.map((s, i) => <text key={s.id} x={x(i)} y={bottom + 26} textAnchor="middle" className="plot-tick">{overlay && scenarios.length <= 4 && s.depth !== null ? `${fmt(s.depth)} mm` : i + 1}</text>)}
        <text x={annotated ? (left + right)/2 : right} y={annotated ? 307 : 283} textAnchor={annotated ? "middle" : "end"} className="plot-label">Skenario hujan (urutan proyek)</text>
      </svg>
    </div>
    <div className={`scenario-key ${annotated ? "sr-only" : ""}`}><span><i className="baseline-key"/>Tanpa intervensi</span>{!overlay && <span><i className="plan-key"/>{active?.name}</span>}</div>
    <details className={overlay ? "scenario-data-details" : "scenario-data-inline"} open={overlay ? undefined : true}><summary>{overlay ? "Angka tiap hujan" : "Angka setiap skenario"}</summary>
    <div className="scenario-readings" aria-label="Angka setiap skenario">{scenarios.map((s, i) => <button key={s.id} aria-pressed={selectedIndex === i} onClick={() => setScenarioId(s.id)}><span className="chart-number">{i + 1}</span><span>{s.name}<small>{s.depth === null ? "Hujan belum diketahui" : `${fmt(s.depth)} mm`}</small></span><strong>{active?.values[i] === null || active?.values[i] === undefined ? "Belum tersedia" : `${fmt(active.values[i]!)} m³`}</strong></button>)}</div>
    </details>
    {scenario && (!overlay || scenarioId !== null) && <p className="chart-reading"><strong>{scenario.name}</strong><span>Awal: {baseline.values[selectedIndex] === null ? "belum tersedia" : `${fmt(baseline.values[selectedIndex]!)} m³`} · Paket: {active?.values[selectedIndex] == null ? "belum tersedia; periksa data hujan dan kapasitas paket" : `${fmt(active.values[selectedIndex]!)} m³`}</span></p>}
    <p className="chart-footnote sr-only">{overlay ? "Titik mewakili skenario terpisah. Celah berarti data belum lengkap; garis bukan prediksi banjir." : "Garis menghubungkan hasil kejadian yang terpisah untuk perbandingan. Celah berarti data belum lengkap, bukan nol; bukan kurva prediksi banjir."}</p>
  </section>;
}

export function ProjectScenarioChart({ project, plans, overlay = false }: { project: ProjectV2; plans: readonly { id: string; name: string; plan: Plan }[]; overlay?: boolean }) {
  const data = useMemo(() => scenarioChartData(project, plans), [project, plans]);
  return <ScenarioChart {...data} overlay={overlay} />;
}
