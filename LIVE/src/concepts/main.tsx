import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  CloudRain,
  Droplets,
  Layers,
  Leaf,
  Map,
  PanelTop,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { Spatial } from "./Spatial";
import { useStudio, type Studio } from "./useStudio";
import {
  Comparison,
  Contributions,
  Options,
  RainControls,
  Reset,
  Sources,
  Unknown,
  WaterBalance,
  ZoneFields,
} from "./Controls";
import { colors, number, evaluateDemo } from "./data";
import "./concepts.css";

const names = ["Atelier", "Lintasan", "Spektrum"] as const;
const ids = ["atelier", "lintasan", "spektrum"] as const;
function Ribbon({ active }: { active: string }) {
  return (
    <nav className="concept-ribbon" aria-label="Pilihan konsep">
      <a className="gallery-link" href="/concepts.html" aria-label="Kembali ke tiga konsep Studio">
        <ArrowLeft size={14} />
        <span>Tiga Studio</span>
      </a>
      <div>
        {ids.map((id, i) => (
          <a
            className={active === id ? "active" : ""}
            aria-current={active === id ? "page" : undefined}
            key={id}
            href={`?studio=${id}`}
          >
            {names[i]}
          </a>
        ))}
      </div>
      <span className="prototype-label">Prototipe · data simulasi</span>
    </nav>
  );
}
function Wordmark() {
  return (
    <span className="wordmark">
      <Droplets size={22} />
      <strong>TIRTA</strong>
    </span>
  );
}
const chapters = [
  {
    name: "Persil",
    icon: Map,
    question: "Kenali bagian lahanmu.",
    body: "Setiap bidang punya peran. Pilih zona, periksa permukaan dan data yang sudah kamu ketahui.",
  },
  {
    name: "Hujan",
    icon: CloudRain,
    question: "Satu persil. Beberapa hujan.",
    body: "Uji hujan yang berbeda pada lahan yang sama. Semua angka tetap bisa ditelusuri ke inputnya.",
  },
  {
    name: "Intervensi",
    icon: Leaf,
    question: "Beri air tempat yang baru.",
    body: "Coba dua penanganan yang terdeklarasi. Lihat target, kapasitas kejadian, biaya, dan kebutuhan ruangnya.",
  },
  {
    name: "Bandingkan",
    icon: Table2,
    question: "Pilihan berbeda. Konsekuensi berbeda.",
    body: "Lebih sedikit limpasan membutuhkan biaya atau ruang. Tentukan trade-off yang masuk akal untukmu.",
  },
];
function ZoneStrip({ s }: { s: Studio }) {
  return (
    <div className="zone-strip" aria-label="Pilih bagian persil">
      {s.project.zones.map((z, i) => (
        <button
          key={z.id}
          className={s.selected === z.id ? "active" : ""}
          aria-pressed={s.selected === z.id}
          onClick={() => s.select(z.id)}
        >
          <span
            className="surface-swatch"
            style={{ background: colors[z.surface ?? "soil"] }}
          />
          <span>
            {i + 1}. {z.name}
          </span>
          {s.project.parameters.find((p) => p.id === z.coefficient.id)
            ?.value === null && <span className="missing-dot">?</span>}
        </button>
      ))}
    </div>
  );
}
function Atelier({ s, onReset }: { s: Studio; onReset: () => void }) {
  return (
    <div className="concept atelier">
      <Ribbon active="atelier" />
      <header className="atelier-header">
        <Wordmark />
        <div className="project-name">
          <h1>Studio Persil</h1>
          <span>Sekolah di antara hujan · 900 m² / demo</span>
        </div>
        <Reset onReset={onReset} />
      </header>
      <main>
        <div className="atelier-modebar">
          <div className="mode-tabs" aria-label="Lensa kerja">
            {chapters.map((c, i) => (
              <button
                key={c.name}
                className={s.step === i ? "active" : ""}
                aria-pressed={s.step === i}
                onClick={() => {
                  s.setStep(i);
                  s.setOverlay(i === 1);
                }}
              >
                <c.icon size={17} />
                {c.name}
              </button>
            ))}
          </div>
          <span className="schematic-note">Skematis · bukan peta ukur</span>
        </div>
        <div className="atelier-work">
          <div className="atelier-scene-title">
            <div>
              <h2>
                {s.step === 0
                  ? "Bentuk tempat. Pahami airnya."
                  : chapters[s.step]!.question}
              </h2>
              <p>
                {s.step === 0
                  ? "Pilih sebuah zona. Data dan tindakan mengikuti pilihanmu."
                  : "Persil tetap sama saat kamu berpindah pertanyaan."}
              </p>
            </div>
            <button
              className="layer-toggle"
              aria-pressed={s.overlay}
              onClick={() => s.setOverlay(!s.overlay)}
            >
              <Layers size={17} />
              {s.overlay ? "Kontribusi air" : "Material permukaan"}
            </button>
          </div>
          <div className="atelier-spatial-grid">
            <div className="atelier-object-pane"><ZoneFields s={s} compact/><Unknown s={s}/></div>
            <Spatial s={s} />
          </div>
          <ZoneStrip s={s} />
        </div>
        <div className="atelier-dock">
          <p>Pilih objek, geser bentuknya, atau tarik titik sudut. Luas perhitungan tetap dari data yang kamu masukkan.</p>
          <div className="dock-next">
            <button
              className="primary"
              onClick={() => s.setStep((s.step + 1) % 4)}
            >
              {s.step === 3
                ? "Kembali menyusun persil"
                : `Lanjut ke ${chapters[s.step + 1]?.name}`}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        {s.step > 0 && (
          <section className="atelier-analysis">
            <RainControls s={s} />
            {s.step === 1 ? (
              <>
                <WaterBalance s={s} />
                <Contributions s={s} />
              </>
            ) : s.step === 2 ? (
              <>
                <Options s={s} />
                <WaterBalance s={s} />
              </>
            ) : (
              <Comparison s={s} />
            )}
          </section>
        )}
        <footer>
          <span>Atelier · semua perubahan sementara</span>
          <span>Estimasi pra-perencanaan, bukan desain teknis</span>
        </footer>
      </main>
    </div>
  );
}
function Lintasan({ s, onReset }: { s: Studio; onReset: () => void }) {
  const c = chapters[s.step]!;
  return (
    <div className="concept lintasan">
      <Ribbon active="lintasan" />
      <div className="journey-layout">
        <aside className="journey-guide">
          <Wordmark />
          <h1>Selangkah lebih dekat ke lahan yang kamu pahami.</h1>
          <p className="journey-project">
            Sekolah di antara hujan
            <br />
            <span>900 m² · persil demonstrasi</span>
          </p>
          <nav aria-label="Langkah perencanaan">
            {chapters.map((chapter, i) => (
              <button
                key={chapter.name}
                aria-current={s.step === i ? "step" : undefined}
                className={s.step === i ? "active" : ""}
                onClick={() => {
                  s.setStep(i);
                  s.setOverlay(i === 1);
                }}
              >
                <span className="chapter-number">
                  {i + 1}
                </span>
                <span>
                  {chapter.name}
                  <small>
                    {
                      [
                        "Kenali isi lahan",
                        "Uji kondisi awal",
                        "Coba penanganan",
                        "Baca konsekuensinya",
                      ][i]
                    }
                  </small>
                </span>
                {s.step === i && <ArrowRight size={17} />}
              </button>
            ))}
          </nav>
          <div className="journey-guide-bottom">
            <p>
              Tidak perlu tahu semua angka sekarang. Yang belum diketahui tetap
              terlihat.
            </p>
            <Reset onReset={onReset} />
          </div>
        </aside>
        <main className="journey-main">
          <header className="journey-heading">
            <div>
              <h2>{c.question}</h2>
              <p>{c.body}</p>
            </div>
            <span className="chapter-count">{s.step + 1} / 4</span>
          </header>
          <Unknown s={s}/>
          <div className="journey-site">
            <div className="site-sheet-heading">
              <span>
                <Map size={17} /> Persil yang sedang kamu pelajari
              </span>
              <span>Sketsa · bukan ukuran</span>
            </div>
            <Spatial s={s} variant="lintasan" />
            <div className="journey-zone-selector">
              <button
                aria-label="Zona sebelumnya"
                onClick={() =>
                  s.select(`z${(Number(s.selected.slice(1)) + 4) % 5}`)
                }
              >
                <ArrowLeft size={20} />
              </button>
              <span>
                <strong>{s.zone.name}</strong>
                <small>
                  Bagian {Number(s.selected.slice(1)) + 1} dari 5 · pilih juga
                  langsung di sketsa
                </small>
              </span>
              <button
                aria-label="Zona berikutnya"
                onClick={() =>
                  s.select(`z${(Number(s.selected.slice(1)) + 1) % 5}`)
                }
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
          <section className="journey-task">
            {s.step === 0 ? (
              <>
                <div className="journey-task-title">
                  <h3>Data untuk bagian ini</h3>
                  <span>
                    {s.missing.length
                      ? `${s.missing.length} bagian belum lengkap`
                      : "5 bagian terisi"}
                  </span>
                </div>
                <ZoneFields s={s} />
              </>
            ) : s.step === 1 ? (
              <>
                <RainControls s={s} />
                <WaterBalance s={s} />
                <Contributions s={s} />
              </>
            ) : s.step === 2 ? (
              <>
                <Options s={s} />
              </>
            ) : (
              <>
                <RainControls s={s} />
                <Comparison s={s} />
                <Sources />
              </>
            )}
            <div className="journey-next">
              <span>
                {s.step === 0 && s.missing.length
                  ? "Kamu boleh lanjut melihat langkah berikutnya; hasil menunggu data lengkap."
                  : "Persil dan pilihanmu tetap dibawa ke langkah berikutnya."}
              </span>
              <button
                className="primary"
                onClick={() => {
                  s.setStep((s.step + 1) % 4);
                  s.setOverlay(s.step === 0);
                }}
              >
                {s.step === 3
                  ? "Refine persil"
                  : `Lanjut: ${chapters[s.step + 1]?.name}`}
                <ArrowRight size={19} />
              </button>
            </div>
          </section>
          <footer>
            Lintasan · perubahan sementara · estimasi pra-perencanaan
          </footer>
        </main>
      </div>
    </div>
  );
}
function Spektrum({ s, onReset }: { s: Studio; onReset: () => void }) {
  const [lens, setLens] = useState<"spatial" | "data">("spatial");
  const [tab, setTab] = useState<"compare" | "options">("compare");
  const result=evaluateDemo(s.project,s.scenario,s.options);
  return (
    <div className="concept spektrum">
      <Ribbon active="spektrum" />
      <header className="spectrum-header">
        <div>
          <Wordmark />
          <h1>Spektrum Persil</h1>
          <p>Sekolah di antara hujan · 900 m² dari data demo</p>
        </div>
        <RainControls s={s} compact/>
        <Reset onReset={onReset} />
      </header>
      <main>
        <div className="spectrum-orientation">
          <span>
            <Map size={17} /> Persil
          </span>
          <ArrowRight size={14} />
          <span>
            <CloudRain size={17} /> Hujan & kondisi awal
          </span>
          <ArrowRight size={14} />
          <span>
            <Leaf size={17} /> Intervensi
          </span>
          <ArrowRight size={14} />
          <span>
            <Table2 size={17} /> Bandingkan
          </span>
        </div>
        <Unknown s={s} />
        {result&&<div className="consequence-strip"><span>Awal <strong>{number(result.baseline.runoffM3)} m³</strong></span><ArrowRight size={18}/><span>{s.options.length?'Dengan rencana terpilih':'Tanpa intervensi'} <strong>{number(result.residual)} m³</strong></span><span>Tertangani <strong>{number(result.handled)} m³ / kejadian</strong></span><button className="text-action" onClick={()=>{setTab('compare');document.querySelector('.spectrum-lower-tabs')?.scrollIntoView({block:'start'});}}>Bandingkan rincian <ArrowRight size={15}/></button></div>}
        <div className="mobile-lens">
          <button
            aria-pressed={lens === "spatial"}
            onClick={() => setLens("spatial")}
          >
            <Map size={17} /> Spasial
          </button>
          <button
            aria-pressed={lens === "data"}
            onClick={() => setLens("data")}
          >
            <Table2 size={17} /> Data zona
          </button>
        </div>
        <div className={`spectrum-linked lens-${lens}`}>
          <section className="spectrum-map">
            <div className="section-heading">
              <h2>Tempat asal air</h2>
              <button
                className="text-action"
                aria-pressed={s.overlay}
                onClick={() => s.setOverlay(!s.overlay)}
              >
                <Layers size={16} />
                {s.overlay ? "Lihat material" : "Lihat kontribusi"}
              </button>
            </div>
            <Spatial s={s} variant="spektrum" />
            <span className="spectrum-map-caption">
              Pilih zona untuk menelusuri kontribusinya. Sketsa bukan peta ukur.
            </span>
          </section>
          <section className="spectrum-data">
            <Contributions s={s} />
            <ZoneFields s={s} />
          </section>
        </div>
        <div className="spectrum-water">
          <WaterBalance s={s} />
          <div className="spectrum-disposition">
            <Droplets size={24} />
            <h3>Penanganan terpilih</h3>
            <p>
              {s.options.length
                ? s.options
                    .map((o) => (o === "tank" ? "Tangki" : "Taman hujan"))
                    .join(" + ")
                : "Belum ada intervensi"}
            </p>
            <button className="text-action" onClick={() => setTab("options")}>
              Ubah rencana <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className="spectrum-lower-tabs">
          <button
            className={tab === "compare" ? "active" : ""}
            aria-pressed={tab === "compare"}
            onClick={() => setTab("compare")}
          >
            <Table2 size={17} /> Bandingkan pilihan
          </button>
          <button
            className={tab === "options" ? "active" : ""}
            aria-pressed={tab === "options"}
            onClick={() => setTab("options")}
          >
            <SlidersHorizontal size={17} /> Susun intervensi
          </button>
          <span>
            {s.baseline.ok
              ? `${number(s.baseline.value.rainfallMm)} mm · hasil aktif`
              : "Menunggu data"}
          </span>
        </div>
        {tab === "compare" ? <Comparison s={s} /> : <Options s={s} />}
        <Sources />
        <footer>
          <span>Spektrum · perubahan sementara</span>
          <span>Tidak ada skor atau BEST tersembunyi</span>
        </footer>
      </main>
    </div>
  );
}
function Thumbnail({ i }: { i: number }) {
  return (
    <div className={`concept-mini mini-${i}`} aria-hidden="true">
      <div className="mini-header" />
      <div className="mini-sidebar" />
      <svg viewBox="0 0 400 240">
        <path d="M65 35H340V207H65Z" className="mini-parcel" />
        <path d="M85 55H190V90H165V130H85Z" fill="#bab1a6" />
        <path d="M208 55H319V130H208Z" fill="#a1ba91" />
        <path d="M85 145H190V190H85Z" fill="#d8d7ce" />
        <path
          d="M210 145H320V190H210Z"
          fill="#d6b594"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="199" cy="110" r="11" fill="#45666a" />
      </svg>
      <div className="mini-details">
        <span />
        <span />
        <span />
      </div>
      <div className="mini-dock" />
    </div>
  );
}
function Gallery() {
  return (
    <main className="concept-gallery">
      <header>
        <Wordmark />
        <span>Design reset / September 2026</span>
      </header>
      <section className="gallery-intro">
        <h1>
          Satu persil.
          <br />
          Tiga cara berpikir.
        </h1>
        <p>
          Studio Persil sebagai tempat bekerja, belajar, atau menguji keputusan.
          Tiga prototipe dengan data dan batas ilmiah yang sama—siap dicoba,
          belum menjadi desain final.
        </p>
      </section>
      <div className="gallery-concepts">
        {names.map((name, i) => (
          <a className="gallery-concept" href={`?studio=${ids[i]}`} key={name}>
            <Thumbnail i={i} />
            <div className="concept-card-heading">
              <h2>{name}</h2>
              <ArrowRight size={23} />
            </div>
            <p>
              {
                [
                  "Bekerja langsung pada objek. Kanvas luas, alat kontekstual, data mengikuti pilihan.",
                  "Belajar sambil menyusun. Satu pertanyaan setiap langkah, persil selalu ikut.",
                  "Melihat sebab dan konsekuensi bersama. Zona, kontribusi air, dan alternatif saling terhubung.",
                ][i]
              }
            </p>
            <span className="try-link">
              Coba {name} <ArrowRight size={16} />
            </span>
          </a>
        ))}
      </div>
      <section className="gallery-instructions">
        <PanelTop size={25} />
        <div>
          <h2>Coba satu alur yang sama di ketiganya.</h2>
          <p>
            Pilih zona → lengkapi UNKNOWN dengan asumsi demo → geser atau edit
            titik sketsa → uji hujan → lihat intervensi dan bandingkan. Pada
            layar sempit, setiap konsep mengubah cara kerjanya.
          </p>
          <p>
            Data sementara; muat ulang untuk mengulang. Mesin baseline digunakan
            langsung dari domain TIRTA. Intervensi adalah dua contoh
            terdeklarasi, bukan optimizer.
          </p>
        </div>
      </section>
      <footer>
        Pilihan arah berada pada owner. Seluruh UI produksi menunggu
        persetujuan.
      </footer>
    </main>
  );
}
function Concept({ id, onReset }: { id: string; onReset: () => void }) {
  const s = useStudio();
  return id === "atelier" ? (
    <Atelier s={s} onReset={onReset} />
  ) : id === "lintasan" ? (
    <Lintasan s={s} onReset={onReset} />
  ) : (
    <Spektrum s={s} onReset={onReset} />
  );
}
function App() {
  const id = new URLSearchParams(location.search).get("studio");
  const [revision, setRevision] = useState(0);
  return id && ids.some((x) => x === id) ? (
    <Concept
      key={`${id}-${revision}`}
      id={id}
      onReset={() => setRevision((r) => r + 1)}
    />
  ) : (
    <Gallery />
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
