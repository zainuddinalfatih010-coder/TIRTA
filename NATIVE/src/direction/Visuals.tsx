import { Database, Droplets, Info } from "lucide-react";
import { CalculationSource } from "./CalculationSource";
import { VolumeChart } from "./ScientificCharts";
import { fmt, money, type Evaluation, type Limits } from "./productionBridge";
import type { PackageResources } from '../domain/treatmentEditing';

export function WaterPartition({
  result,
  baselineOnly = false,
  compactDetails = false,
}: {
  result: Evaluation;
  baselineOnly?: boolean;
  compactDetails?: boolean;
}) {
  const total = result.baseline.runoffM3;
  const retained = baselineOnly ? 0 : result.retained,
    infiltrated = baselineOnly ? 0 : result.infiltrated;
  const reused = baselineOnly ? 0 : result.reused;
  const residual = baselineOnly ? total : result.residual;
  const portions = [
    {
      name: "Ditampung",
      color: "#007eaa",
      value: retained,
      className: "stored",
      note: "Tersimpan setelah kejadian",
    },
    {
      name: "Diinfiltrasikan",
      color: "#698846",
      value: infiltrated,
      className: "infiltrated",
      note: "Kapasitas event yang dinyatakan",
    },
    ...(reused > 0 ? [{ name: "Dimanfaatkan", value: reused, color: "#72639b", className: "reused", note: "Pemanfaatan selama kejadian" }] : []),
    {
      name: "Sisa limpasan",
      color: "#57717e",
      value: residual,
      className: "residual",
      note: "Masih perlu ditangani",
    },
  ];
  return (
    <section className="water-partition" aria-label="Pembagian volume limpasan">
      <div className="water-origin">
        <div>
          <Droplets size={20} />
          <span>Limpasan kondisi awal</span>
        </div>
        <strong>
          {fmt(total)} <small>m³/kejadian</small>
        </strong>
      </div>
      <p className="partition-caption">
        {baselineOnly ? "Belum ada intervensi" : "Ke mana volume limpasan ditangani?"}
        <span>Pilih bagian grafik untuk melihat artinya. Lebar batang menyatakan volume.</span>
      </p>
      <VolumeChart total={total} parts={portions} compactDetails={compactDetails} />
      <p className="equation-note">
        {fmt(total)} = {fmt(retained)} + {fmt(infiltrated)}{reused > 0 ? ` + ${fmt(reused)}` : ""} + {fmt(residual)}{" "}
        m³. {reused > 0 ? "Pemanfaatan memakai kebutuhan yang dinyatakan untuk kejadian ini." : "Tidak ada pemanfaatan selama kejadian yang dihitung."}
      </p>
      <CalculationSource method="ledger" />
    </section>
  );
}

export function InterventionIllustration({ kind, x, y, width, height }: { kind: "tank" | "soak" | "garden" | "porous" | "biopori"; x?: number; y?: number; width?: number; height?: number }) {
  return (
    <svg className={`intervention-illustration ${kind}`} viewBox="0 0 144 120" x={x} y={y} width={width} height={height} aria-hidden="true">
      {kind === "tank" ? (
        <>
          <ellipse cx="69" cy="108" rx="40" ry="5" fill="#203e4610" />
          <path d="M37 29V92C37 110 101 110 101 92V29" fill="#e5eff0" stroke="#2f6370" strokeWidth="2" />
          <path d="M47 39V90M52 43V94" stroke="white" strokeWidth="3" />
          <path d="M37 65C37 82 101 82 101 65M37 85C37 102 101 102 101 85" fill="none" stroke="#8eafb6" />
          <ellipse cx="69" cy="29" rx="32" ry="12" fill="#f8fcfc" stroke="#2f6370" strokeWidth="2" />
          <ellipse cx="69" cy="27" rx="12" ry="4" fill="#c8dce0" stroke="#6e929b" />
          <path d="M101 85H113V98H124" stroke="#2f6370" strokeWidth="3" fill="none" />
          <path d="M49 14H58M54 10V18" stroke="#8eafb6" />
        </>
      ) : kind === "biopori" ? (
        <>
          <path d="M24 45H120V104H24Z" fill="#e4dcc6" stroke="#857c63" strokeWidth="1.5" />
          <path d="M59 39H85V99H59Z" fill="#e5eff0" stroke="#2f6370" strokeWidth="2" />
          <ellipse cx="72" cy="39" rx="13" ry="5" fill="#f8fcfc" stroke="#2f6370" strokeWidth="2" />
          <path d="M63 54h18M63 68h18M63 82h18" stroke="#71865b" strokeWidth="4" strokeDasharray="4 3" />
          <path d="M59 57h-5M59 73h-5M59 89h-5M85 57h5M85 73h5M85 89h5" stroke="#6d8e89" strokeWidth="2" />
          <path d="M72 18V30m-4-4 4 4 4-4" fill="none" stroke="#2f6370" strokeWidth="2" />
        </>
      ) : kind === "soak" ? (
        <>
          <ellipse cx="72" cy="108" rx="48" ry="5" fill="#203e4610" />
          <path d="M31 41H113L103 102H41Z" fill="#e4dcc6" stroke="#857c63" strokeWidth="1.5" />
          <path d="M42 48H102L96 91H48Z" fill="#c9d9d4" stroke="#6d8e89" />
          <path d="M49 54H95M47 64H97M45 74H99M44 84H100" stroke="#9ab4ae" />
          <path d="M63 28V48M81 28V48M72 17V51" stroke="#2f6370" strokeWidth="2" strokeLinecap="round" />
          <path d="M58 25l5 4 5-4M76 25l5 4 5-4M67 14l5 4 5-4" fill="none" stroke="#2f6370" strokeWidth="2" />
          <path d="M42 98h60" stroke="#71865b" strokeWidth="2" strokeDasharray="5 4" />
        </>
      ) : kind === "porous" ? (
        <>
          <ellipse cx="72" cy="108" rx="55" ry="5" fill="#203e4610" />
          <path d="M17 62L72 40L127 62L72 85Z" fill="#d9d6ca" stroke="#7f8077" strokeWidth="1.5" />
          <path d="M22 70L72 50L122 70L72 91Z" fill="#b9c8bf" opacity=".72" />
          <path d="M31 74l15-6 15 6-15 6zm26-10 15-6 15 6-15 6zm26 10 15-6 15 6-15 6" fill="#eef2ed" stroke="#8a968d" />
          <path d="M42 84v15M72 88v16M102 84v15" stroke="#4f7881" strokeWidth="2" strokeLinecap="round" />
          <path d="M38 95l4 5 4-5M68 100l4 5 4-5M98 95l4 5 4-5" fill="none" stroke="#4f7881" strokeWidth="2" />
        </>
      ) : (
        <>
          <ellipse cx="72" cy="108" rx="58" ry="5" fill="#203e4610" />
          <path d="M13 70Q72 51 131 70L116 101Q72 112 28 101Z" fill="#e3dcc7" stroke="#8a8267" strokeWidth="1.5" />
          <path d="M18 71Q72 86 126 71L118 88Q72 103 25 88Z" fill="#b8c7a0" />
          <ellipse cx="72" cy="69" rx="59" ry="13" fill="#e5ecd9" stroke="#71865b" strokeWidth="1.5" />
          <path d="M40 69V35M40 55Q22 51 22 36Q39 39 40 55M40 46Q55 37 54 25Q40 29 40 46M73 72V26M73 55Q57 51 58 40Q73 43 73 55M73 45Q91 36 89 19Q73 27 73 45M106 66V40M106 55Q92 49 91 35M106 52Q118 43 118 31" stroke="#657c48" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M37 94l3 1m14 4 3 1m21 0 3-1m17-4 3-1" stroke="#94886c" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
export function ConstraintMeters({
  result,
  limits,
  resources,
}: {
  result: Evaluation | null;
  limits: Limits;
  resources?: PackageResources;
}) {
  return (
    <div className="constraint-meters">
      {[
        {
          label: "Biaya",
          value: resources ? resources.cost.known : result?.cost,
          unknown: resources?.cost.unknown ?? 0,
          limit: limits.budget,
          format: money,
        },
        {
          label: "Lahan intervensi",
          value: resources ? resources.area.known : result?.area,
          unknown: resources?.area.unknown ?? 0,
          limit: limits.land,
          format: (n: number) => `${fmt(n)} m²`,
        },
      ].map((row) => (
        <div className="constraint-meter" key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>
              {row.value === undefined ? "—" : row.format(row.value)}{row.unknown > 0 ? " diketahui" : ""}{" "}
              <small>
                /{" "}
                {row.limit === null ? "belum diketahui" : row.format(row.limit)}
              </small>
            </strong>
          </div>
          <div className="meter-track" aria-hidden="true">
            <span
              className={
                row.limit !== null &&
                row.value !== undefined &&
                row.value > row.limit
                  ? "over-limit"
                  : ""
              }
              style={{
                width:
                  row.value === undefined || row.limit === null
                    ? 0
                    : `${row.limit === 0 ? (row.value > 0 ? 100 : 0) : Math.min(100, (row.value / row.limit) * 100)}%`,
              }}
            />
          </div>
          <small>
            {row.unknown > 0 && `${row.unknown} ${row.label === 'Biaya' ? 'biaya' : 'luas pemasangan'} belum diketahui · `}
            {row.value !== undefined && row.limit !== null && row.limit > 0 && `${row.unknown ? 'Minimal ' : ''}${fmt(row.value / row.limit * 100)}% terpakai · `}
            {row.unknown > 0 && row.value !== undefined && (row.limit === null || row.value <= row.limit) ? "Total dan sisa belum dapat ditentukan." : row.value === undefined
              ? "Lengkapi input untuk menilai batas."
              : row.limit === null
                ? "Isi batas untuk memeriksa kelayakan."
                : row.value > row.limit
                  ? `${row.label === "Biaya" ? "Melebihi batas dana" : "Melebihi batas lahan"} ${row.format(row.value - row.limit)}`
                  : `Sisa ${row.format(row.limit - row.value)}`}
          </small>
        </div>
      ))}
    </div>
  );
}
export function SourceNote({ children }: { children?: React.ReactNode }) {
  return (
    <details className="source-note">
      <summary>
        <Database size={16} />
        Sumber & cara hitung
      </summary>
      <div>
        {children ?? (
          <>
            <p>
              Seluruh nilai pada proyek contoh ini adalah data demo sintetis.
              Luas, koefisien, hujan, biaya, lahan dan kapasitas bukan hasil
              survei.
            </p>
            <p>
              Limpasan per zona = luas × hujan / 1.000 × koefisien. Kelas
              permukaan tidak menentukan koefisien secara otomatis.
            </p>
            <CalculationSource method="runoff" />
            <p>
              Tangki menerima air dari Gedung belajar; taman hujan dari Halaman
              kegiatan. Ini target demo yang dinyatakan, bukan kesimpulan dari
              kedekatan pada sketsa.
            </p>
            <p>
              Penanganan dibatasi volume limpasan zona target. Tampungan dan
              infiltrasi tidak dihitung ganda. Non-limpasan awal tidak otomatis
              berarti infiltrasi.
            </p>
            <CalculationSource method="ledger" />
          </>
        )}
      </div>
    </details>
  );
}
export function Missing({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="missing-state">
      <Info size={21} />
      <div>
        <strong>{title}</strong>
        <p>
          Hasil ditahan sampai input yang diperlukan lengkap. Nilai kosong bukan
          nol.
        </p>
        <button className="text-button" onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  );
}
