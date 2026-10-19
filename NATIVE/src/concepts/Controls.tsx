import { useState } from "react";
import {
  ArrowRight,
  Check,
  CloudRain,
  Droplets,
  Info,
  Leaf,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  surfaceLabels,
  surfaceSchema,
  ref,
  type Parameter,
} from "../domain/model";
import { numericInput } from "../domain/validation";
import {
  colors,
  demoOptions,
  evaluateDemo,
  number,
  type OptionId,
} from "./data";
import type { Studio } from "./useStudio";

export function Unknown({ s }: { s: Studio }) {
  if (!s.missing.length)
    return (
      <p className="ready-line">
        <Check size={16} /> Semua koefisien terisi · asumsi demo
      </p>
    );
  return (
    <div className="unknown">
      <TriangleAlert size={19} />
      <div>
        <strong>{s.missing[0]?.name} belum punya koefisien.</strong>
        <p>
          Baseline menunggu angka ini. Jenis permukaan tidak menentukan
          koefisien.
        </p>
        <button
          className="text-action"
          onClick={() => {
            if(s.missing[0])s.select(s.missing[0].id);
            s.resolve();
          }}
        >
          Gunakan asumsi demo C = {number([.9,.8,.2,.3,.4][Number(s.missing[0]?.id.slice(1))]??.3)} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
export function Sources() {
  return (
    <details className="sources">
      <summary>
        <Info size={15} /> Sumber & batas estimasi
      </summary>
      <p>
        Semua luas, hujan, koefisien, biaya, dan kapasitas di prototipe ini
        adalah <strong>data simulasi</strong> untuk menilai antarmuka. Bukan
        hasil survei atau rekomendasi desain.
      </p>
      <p>
        Luas perhitungan 900 m² berasal dari fixture demo, bukan bentuk sketsa.
        Limpasan = luas × hujan / 1.000 × koefisien. Posisi simbol tidak
        menentukan koneksi atau kapasitas.
      </p>
      <p>
        Tangki terhubung secara eksplisit ke Gedung belajar; taman hujan ke
        Halaman kegiatan. Kredit air dibatasi limpasan zona target. Tidak ada
        inferensi dari kedekatan objek.
      </p>
    </details>
  );
}
export function ZoneFields({
  s,
  compact = false,
}: {
  s: Studio;
  compact?: boolean;
}) {
  return (
    <section
      className={`zone-fields ${compact ? "compact" : ""}`}
      aria-label="Data zona terpilih"
    >
      <div className="zone-field-heading">
        <span
          className="surface-swatch"
          style={{ background: colors[s.zone.surface ?? "soil"] }}
        />
        <div>
          <h2>{s.zone.name}</h2>
          <p>
            Zona {Number(s.selected.slice(1)) + 1} ·{" "}
            {number(
              s.project.parameters.find((p) => p.id === s.zone.area.id)
                ?.value ?? 0,
            )}{" "}
            m² dari data demo
          </p>
        </div>
        <span
          className={`data-status ${s.coefficient.value === null ? "missing" : ""}`}
        >
          {s.coefficient.value === null ? "Belum lengkap" : "Terisi"}
        </span>
      </div>
      <div className="field-editors">
        <label>
          Jenis permukaan
          <select
            value={s.zone.surface ?? ""}
            onChange={(e) => {
              const parsed = surfaceSchema.safeParse(e.target.value);
              if (parsed.success) s.changeSurface(parsed.data);
            }}
          >
            {surfaceSchema.options.map((v) => (
              <option key={v} value={v}>
                {surfaceLabels[v]}
              </option>
            ))}
          </select>
        </label>
        <Coefficient key={`${s.selected}-${s.coefficient.value}`} s={s} />
      </div>
      <Sources />
    </section>
  );
}
function Coefficient({ s }: { s: Studio }) {
  const [text, setText] = useState(
    s.coefficient.value === null ? "" : String(s.coefficient.value),
  );
  const [error, setError] = useState("");
  return (
    <form
      className="coefficient-form"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = numericInput(text);
        if (!parsed.ok || (parsed.value !== null && parsed.value > 1)) {
          setError("Isi angka 0–1, atau kosongkan jika belum diketahui.");
          return;
        }
        s.changeCoefficient(parsed.value);
        setError("");
      }}
    >
      <label>
        Koefisien limpasan C <span className="unit">0–1</span>
        <div className="input-action">
          <input
            aria-label="Koefisien limpasan"
            placeholder="Belum diketahui"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" aria-label="Terapkan koefisien">
            <Check size={18} />
          </button>
        </div>
      </label>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function RainControls({ s, compact=false }: { s: Studio; compact?:boolean }) {
  const scenario = s.project.scenarios.find((x) => x.id === s.scenario)!;
  const p = s.project.parameters.find((x) => x.id === scenario.rainfall.id)!;
  return (
    <div className="rain-controls">
      <div className="rain-presets">
        <CloudRain size={20} />
        <span>Hujan uji</span>
        {s.project.scenarios.map((r) => (
          <button
            aria-pressed={s.scenario === r.id}
            className={s.scenario === r.id ? "active" : ""}
            key={r.id}
            onClick={() => s.setScenario(r.id)}
          >
            {s.project.parameters.find((x) => x.id === r.rainfall.id)?.value == null ? 'Belum diketahui' : number(s.project.parameters.find((x) => x.id === r.rainfall.id)!.value!)}{" "}
            <small>mm</small>
          </button>
        ))}
      </div>
      {compact?<details className="custom-rain"><summary>Ubah hujan aktif</summary><RainInput key={`${s.scenario}-${p.value}`} s={s} parameter={p}/></details>:<RainInput key={`${s.scenario}-${p.value}`} s={s} parameter={p} />}
    </div>
  );
}
function RainInput({ s, parameter }: { s: Studio; parameter: Parameter }) {
  const [text, setText] = useState(String(parameter.value ?? ""));
  const [error, setError] = useState("");
  return (
    <form
      className="rain-input"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = numericInput(text);
        if (!parsed.ok) {
          setError("Isi hujan yang valid atau kosongkan.");
          return;
        }
        const next: Parameter = {
          ...parameter,
          value: parsed.value,
          evidence: parsed.value === null ? "UNKNOWN" : "DEMO",
          source:
            parsed.value === null
              ? ""
              : "Hujan uji sintetis, diedit pengguna di prototipe.",
        };
        s.setProject((p) => ({
          ...p,
          parameters: p.parameters.map((x) => (x.id === next.id ? next : x)),
          scenarios: p.scenarios.map((r) =>
            r.rainfall.id === next.id ? { ...r, rainfall: ref(next) } : r,
          ),
        }));
        setError("");
      }}
    >
      <label>
        Ubah hujan aktif{" "}
        <span className="input-action">
          <input
            inputMode="decimal"
            value={text}
            aria-label="Hujan aktif dalam mm"
            onChange={(e) => setText(e.target.value)}
          />
          <span>mm</span>
          <button type="submit" aria-label="Terapkan hujan">
            <Check size={17} />
          </button>
        </span>
      </label>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function WaterBalance({ s }: { s: Studio }) {
  if (!s.baseline.ok)
    return (
      <div className="water-blocked">
        <Droplets size={30} />
        <div>
          <h3>Baseline belum dapat dihitung</h3>
          <p>
            {s.missing.length
              ? "Lengkapi koefisien Lahan terbuka. Semua hasil memakai persil yang sama."
              : "Hujan atau input persil belum valid. Lengkapi nilai yang diketahui."}
          </p>
        </div>
      </div>
    );
  const b = s.baseline.value;
  return (
    <div className="water-balance">
      <div className="balance-heading">
        <h3>Ke mana air hujan dihitung?</h3>
        <span>
          <Check size={14} /> Dihitung dari input aktif
        </span>
      </div>
      <div className="water-equation">
        <div>
          <span>Air jatuh</span>
          <strong>
            {number(b.rainfallM3)}
            <small>m³</small>
          </strong>
        </div>
        <span className="equation-sign">=</span>
        <div className="runoff-stat">
          <span>Limpasan awal</span>
          <strong data-testid="runoff">
            {number(b.runoffM3)}
            <small>m³</small>
          </strong>
        </div>
        <span className="equation-sign">+</span>
        <div>
          <span>Bagian non-limpasan</span>
          <strong>
            {number(b.nonRunoffM3)}
            <small>m³</small>
          </strong>
        </div>
      </div>
      <div
        className="balance-bar"
        role="img"
        aria-label={`${number(b.runoffM3)} dari ${number(b.rainfallM3)} m³ menjadi limpasan`}
      >
        <span
          style={{
            width: `${b.rainfallM3 ? (b.runoffM3 / b.rainfallM3) * 100 : 0}%`,
          }}
        />
      </div>
      <p>
        Per kejadian {number(b.rainfallMm)} mm · non-limpasan bukan otomatis
        infiltrasi.
      </p>
    </div>
  );
}
export function Contributions({ s }: { s: Studio }) {
  const max = s.baseline.ok
    ? Math.max(1, ...s.baseline.value.zones.map((z) => z.runoffM3))
    : 1;
  return (
    <section className="contributions">
      <div className="section-heading">
        <h3>Kontribusi tiap zona</h3>
        <span>m³ / kejadian</span>
      </div>
      {s.project.zones.map((zone, i) => {
        const runoff = s.baseline.ok
          ? s.baseline.value.zones.find((z) => z.id === zone.id)?.runoffM3
          : null;
        return (
          <button
            className={`contribution-row ${s.selected === zone.id ? "active" : ""}`}
            key={zone.id}
            aria-pressed={s.selected === zone.id}
            onClick={() => s.select(zone.id)}
          >
            <span className="row-label">
              <span className="row-number">{i + 1}</span>
              {zone.name}
            </span>
            <span className="contribution-track" style={runoff==null?{background:'transparent'}:undefined}>
              <span
                style={{
                  width: `${runoff != null ? (runoff / max) * 100 : 0}%`,
                  background: colors[zone.surface ?? "soil"],
                }}
              />
            </span>
            <strong>{runoff != null ? number(runoff) : "—"}</strong>
          </button>
        );
      })}
      {!s.baseline.ok && (
        <p className="muted">Kontribusi muncul setelah input lengkap.</p>
      )}
    </section>
  );
}
export function Options({ s }: { s: Studio }) {
  const result = evaluateDemo(s.project, s.scenario, s.options);
  return (
    <section className="option-section">
      <div className="section-heading">
        <h3>Coba penanganan air</h3>
        <span>Dua opsi demo</span>
      </div>
      <div className="option-choices">
        {demoOptions.map((o) => (
          <button
            key={o.id}
            className={`option-choice ${s.options.includes(o.id) ? "active" : ""}`}
            aria-pressed={s.options.includes(o.id)}
            onClick={() => s.toggleOption(o.id)}
          >
            {o.id === "tank" ? <Droplets size={23} /> : <Leaf size={23} />}
            <span>
              <strong>{o.name}</strong>
              <small>
                {o.capacity} m³ / kejadian · Rp{o.cost / 1e6} jt · {o.area} m²
              </small>
              <small>Target: {o.targetName}</small>
            </span>
            {s.options.includes(o.id) ? (
              <Check size={18} />
            ) : (
              <Plus size={18} />
            )}
          </button>
        ))}
      </div>
      <p className="option-boundary">
        Simbol menunjukkan rencana. Kapasitas dan target berasal dari deklarasi
        demo, bukan ukuran atau posisi simbol.
      </p>
      {result && (
        <div className="constraint-band">
          <span>
            Biaya <strong>Rp{number(result.cost / 1e6)} / 12 jt</strong>
          </span>
          <span>
            Ruang <strong>{result.area} / 24 m²</strong>
          </span>
          <span>Batas demo eksplisit</span>
        </div>
      )}
    </section>
  );
}
const alternatives: { label: string; ids: OptionId[] }[] = [
  { label: "Kondisi awal", ids: [] },
  { label: "Tangki", ids: ["tank"] },
  { label: "Taman hujan", ids: ["garden"] },
  { label: "Keduanya", ids: ["tank", "garden"] },
];
export function Comparison({ s }: { s: Studio }) {
  const baseline = evaluateDemo(s.project, s.scenario, []);
  const max = baseline ? Math.max(1, baseline.residual) : 1;
  return (
    <section className="comparison">
      <div className="section-heading">
        <h3>Ruang lebih sedikit, atau air lebih banyak?</h3>
        <span>Perbandingan contoh · tanpa peringkat</span>
      </div>
      <p className="comparison-scroll-note">Geser tabel untuk melihat biaya dan ruang.</p>
      <div className="comparison-table-wrap" role="region" aria-label="Tabel perbandingan alternatif" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Pilihan</th>
              <th>
                Sisa limpasan <small>m³ / kejadian</small>
              </th>
              <th>Biaya</th>
              <th>Ruang</th>
            </tr>
          </thead>
          <tbody>
            {alternatives.map((a) => {
              const r = evaluateDemo(s.project, s.scenario, a.ids);
              return (
                <tr key={a.label}>
                  <th>{a.label}</th>
                  <td>
                    <span className="residual-cell">
                      <span className="residual-track" style={!r?{background:'transparent'}:undefined}>
                        <span
                          style={{
                            width: `${r ? (r.residual / max) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <strong>{r ? number(r.residual) : "—"}</strong>
                    </span>
                  </td>
                  <td>
                    Rp
                    {demoOptions
                      .filter((o) => a.ids.includes(o.id))
                      .reduce((sum, o) => sum + o.cost, 0) / 1e6}{" "}
                    jt
                  </td>
                  <td>
                    {demoOptions
                      .filter((o) => a.ids.includes(o.id))
                      .reduce((sum, o) => sum + o.area, 0)}{" "}
                    m²
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Contoh terdeklarasi, bukan hasil optimizer. Tangki menampung; taman
        hujan menginfiltrasikan hingga kapasitas event. Tidak ada pilihan
        “terbaik” otomatis.
      </p>
    </section>
  );
}
export function Reset({ onReset }: { onReset: () => void }) {
  return (
    <button className="reset" onClick={onReset}>
      <RotateCcw size={16} /> Mulai ulang demo
    </button>
  );
}
