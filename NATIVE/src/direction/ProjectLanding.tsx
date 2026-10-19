import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CloudRain, Map, Scale, SlidersHorizontal } from "lucide-react";
import { currentDemoProject, evaluate, fmt, money, options } from "./productionBridge";
import { SurfacePatterns } from "./SurfacePatterns";
import { HelpButton } from "./TirtaHelp";

type Stage = "studio" | "rain" | "interventions" | "compare";

/** A declared synthetic example, evaluated by the same engine as the workspace. */
function PlanningExample() {
  const project = useMemo(() => currentDemoProject(), []);
  const [scenario, setScenario] = useState("r50");
  const [handled, setHandled] = useState(true);
  const prefix = `landing-${useId().replace(/:/g, "")}-`;
  const result = useMemo(() => evaluate(project, scenario, handled ? options.map(o => o.id) : []), [project, scenario, handled]);
  return <figure className="landing-example" aria-labelledby="landing-example-title">
    <figcaption className="landing-example-header">
      <div><h3 id="landing-example-title">Contoh penanganan air hujan</h3></div>
      <div className="landing-rain-switch" role="group" aria-label="Hujan pada contoh landing">
        <CloudRain size={19} aria-hidden="true" />
        {[50, 100].map(depth => <button key={depth} aria-pressed={scenario === `r${depth}`} onClick={() => setScenario(`r${depth}`)}>{depth} mm</button>)}
      </div>
    </figcaption>
    <div className="landing-parcel">
      <span className="landing-parcel-caption">CONTOH SINTETIS <span>200 m² · 5 zona</span></span>
      <svg viewBox="0 0 680 354" role="img" aria-label="Sketsa contoh: atap, beton atau aspal, tanah terbuka, vegetasi, dan permukaan berpori. Bukan peta lokasi.">
        <defs><SurfacePatterns prefix={prefix} /></defs>
        {project.zones.map(zone => <polygon key={zone.id} points={zone.polygon.map(p => `${20 + p.x * 32},${15 + p.y * 32}`).join(" ")} fill={`url(#${prefix}${zone.surface})`} stroke="#314f5b" strokeWidth="1.8" />)}
        {[
          { x: 142, y: 113, label: "Atap", id: "1", width: 94 },
          { x: 318, y: 267, label: "Beton / aspal", id: "2", width: 155 },
          { x: 508, y: 174, label: "Tanah", id: "3", width: 104 },
          { x: 484, y: 52, label: "Vegetasi", id: "4", width: 125 },
          { x: 34, y: 298, label: "Berpori", id: "5", width: 120 },
        ].map(({ x, y, width, label, id }) => <g key={id} transform={`translate(${x} ${y})`} aria-hidden="true"><rect width={width} height="33" rx="16.5" fill="#f7fdff" /><circle cx="17" cy="16.5" r="11" fill="#164d67" /><text x="17" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{id}</text><text x="35" y="21" fill="#103750" fontSize="14" fontWeight="600">{label}</text></g>)}
      </svg>
    </div>
    <div className="landing-mode-switch" role="group" aria-label="Komposisi pada contoh landing">
      <button aria-pressed={!handled} onClick={() => setHandled(false)}>Tanpa intervensi</button>
      <button aria-pressed={handled} onClick={() => setHandled(true)}>Dengan 3 intervensi</button>
    </div>
    {result ? <div className="landing-water-result" aria-live="polite" aria-atomic="true">
      <dl><div><dt>Limpasan awal</dt><dd>{fmt(result.baseline.runoffM3)} <small>m³</small></dd></div><ArrowRight aria-hidden="true" /><div><dt>Sisa limpasan</dt><dd>{fmt(result.residual)} <small>m³</small></dd></div></dl>
      <div className="landing-volume-bar" role="img" aria-label={`Ditampung ${fmt(result.retained)} m³; diinfiltrasikan ${fmt(result.infiltrated)} m³; sisa limpasan ${fmt(result.residual)} m³.`}>
        {result.baseline.runoffM3 > 0 && <><span className="stored" style={{ width: `${result.retained / result.baseline.runoffM3 * 100}%` }} /><span className="infiltrated" style={{ width: `${result.infiltrated / result.baseline.runoffM3 * 100}%` }} /><span className="residual" style={{ width: `${result.residual / result.baseline.runoffM3 * 100}%` }} /></>}
      </div>
      <ul className="landing-ledger"><li><i className="stored" />Tampung <strong>{fmt(result.retained)} m³</strong></li><li><i className="infiltrated" />Resapkan <strong>{fmt(result.infiltrated)} m³</strong></li><li><i className="residual" />Sisa <strong>{fmt(result.residual)} m³</strong></li></ul>
      <p className="landing-example-limits">{handled ? `Tangki + resapan + rain garden · ${money(result.cost)} · ${fmt(result.area)} m²` : "Kondisi awal · tanpa biaya atau ruang intervensi"}</p>
    </div> : <p role="status">Contoh belum dapat dihitung. Buka proyek untuk memeriksa datanya.</p>}
    <div className="landing-example-note"><span>Data contoh, bukan hasil lahan Anda.</span><HelpButton topic="interventions" label="Dasar neraca contoh" compact /></div>
  </figure>;
}

export function ProjectLanding({ start, library, backup, secondaryExample, onNavigate, resume }: { start: ReactNode; resume?:ReactNode; library: ReactNode; backup: ReactNode; secondaryExample: ReactNode; onNavigate: (stage: Stage) => void }) {
  return <div className="project-landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <svg className="landing-contours" viewBox="0 0 1440 760" preserveAspectRatio="none" aria-hidden="true"><path d="M420 0H1440V760H0C500 640 830 385 420 0Z" fill="#b6e7f6" /><path d="M720 0H1440V760H260C1100 670 490 230 720 0Z" fill="#95d5ea" opacity=".48" /><path d="M1440 300V760H540C1370 660 1030 420 1440 300Z" fill="#76c8e4" opacity=".22" /></svg>
      <div className="landing-intro">
        <h2 id="landing-title">Rencanakan<br />air hujan<span>.</span></h2>
        <p>Hitung limpasan hujan dan bandingkan intervensi sesuai kondisi lahan.</p>
        <div className="landing-project-controls">
          {resume}
          {start}
          {library}
          {backup}
          {secondaryExample}
        </div>
      </div>
      <PlanningExample />
    </section>
    <nav className="landing-journey" aria-label="Jelajahi alur TIRTA">
      {([
        { id: "studio", label: "Persil", detail: "Batas lahan & permukaan", icon: Map },
        { id: "rain", label: "Hujan", detail: "Skenario & limpasan awal", icon: CloudRain },
        { id: "interventions", label: "Intervensi", detail: "Kapasitas, biaya & ruang", icon: SlidersHorizontal },
        { id: "compare", label: "Bandingkan", detail: "Pilihan, alasan & rencana", icon: Scale },
      ] as const).map((stage, i) => <button key={stage.id} onClick={() => onNavigate(stage.id)}><stage.icon size={27} strokeWidth={1.5} aria-hidden="true" /><span><small>0{i + 1}</small><strong>{stage.label}</strong><span>{stage.detail}</span></span><ArrowRight size={18} aria-hidden="true" /></button>)}
    </nav>
  </div>;
}
