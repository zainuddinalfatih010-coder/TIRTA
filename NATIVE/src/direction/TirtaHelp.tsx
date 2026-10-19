import { createContext, useContext, useState, type ReactNode } from "react";
import { ArrowLeft, CircleHelp, CloudRain, Droplets, Layers, Scale, BookOpen, Info } from "lucide-react";
import { ContextDialog } from "./ContextDialog";
import { CalculationSource } from "./CalculationSource";
import { ScientificReference } from "./ScientificReference";
import { scientificClaims } from "../domain/evidenceRegistry";
import { coefficientGuidance } from "../domain/coefficientGuidance";
import { surfaceLabels } from "../domain/model";
import { MethodGuide } from './MethodGuide';

const topics = {
  overview: { title: "Cara kerja TIRTA", icon: BookOpen, claim: "CLAIM-LOCAL" },
  coefficient: { title: "Permukaan & koefisien", icon: Layers, claim: "CLAIM-POROUS" },
  rainfall: { title: "Hujan & limpasan", icon: CloudRain, claim: "CLAIM-DURATION" },
  interventions: { title: "Menangani air", icon: Droplets, claim: "CLAIM-STORAGE" },
  alternatives: { title: "Memilih di antara alternatif", icon: Scale, claim: "CLAIM-PARETO" },
  methods: { title: "Mengapa metode ini?", icon: BookOpen, claim: null },
} as const;
export type HelpTopic = keyof typeof topics;
const HelpContext = createContext<(topic: HelpTopic, method?: string) => void>(() => undefined);

export function HelpButton({ topic, label = "Kenapa?", compact = false, method }: { topic: HelpTopic; label?: string; compact?: boolean; method?: string }) {
  const open = useContext(HelpContext);
  return <button type="button" className="help-entry text-button" onClick={() => open(topic, method)}><CircleHelp size={19} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>{label}</span></button>;
}

export function TirtaHelpProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [method, setMethod] = useState('rainfall');
  const current = topic ? topics[topic] : null;
  const claim = scientificClaims.find(item => item.id === current?.claim);
  return <HelpContext.Provider value={(next, id) => { setTopic(next); setMethod(id ?? 'rainfall'); }}>
    {children}
    {topic && current && <ContextDialog title="Dasar TIRTA" className="basics-page" onClose={() => setTopic(null)} footer={<button onClick={() => setTopic(null)}><ArrowLeft size={18} />Kembali ke pekerjaan saya</button>}>
      <div className="basics-layout">
        <nav aria-label="Topik Dasar TIRTA">{Object.entries(topics).map(([id, item]) => <button key={id} aria-current={topic === id ? "page" : undefined} onClick={() => setTopic(id as HelpTopic)}><item.icon size={20} /><span>{item.title}</span></button>)}</nav>
        <article className="basics-article" key={topic}>
          <span className="section-kicker">Dasar perhitungan dan penggunaan</span><h1>{current.title}</h1>
          {topic === "overview" && <>
            <p className="basics-lead">TIRTA menghitung limpasan pada persil dan membandingkan intervensi berdasarkan hujan, kapasitas, biaya, dan lahan.</p>
            <div className="basics-process">{["Modelkan lahan", "Uji hujan", "Coba intervensi", "Bandingkan", "Pilih rencana"].map((text, i) => <span key={text}><b>{i + 1}</b>{text}</span>)}</div>
            <h2>Sketsa bukan peta lokasi</h2><p>Bentuk menunjukkan susunan zona. Luas mengikuti dimensi yang Anda nyatakan; TIRTA tidak melakukan survei, mengukur GPS atau memprediksi genangan.</p>
            <h2>Belum diketahui bukan nol</h2><p>Isian kosong berarti belum diketahui. Lengkapi data untuk menghitung hasil; catat sumber atau asumsi yang Anda gunakan.</p>
          </>}
          {topic === "coefficient" && <>
            <p className="basics-lead">C menyatakan bagian air hujan yang menjadi limpasan dalam model ini. Permukaan membantu Anda mencari patokan; permukaan tidak memilih C secara otomatis.</p>
            <div className="coefficient-diagram" aria-label="C berada dari nol hingga satu, bukan nilai otomatis"><span>0<small>Tidak menjadi limpasan</small></span><div className="coefficient-scale" /><span>1<small>Seluruhnya menjadi limpasan</small></span></div>
            <h2>Bagaimana memilihnya?</h2><p>Pilih kelas permukaan, buka patokan, lalu tentukan nilai yang sesuai bahan dan kondisi. Simpan sumber atau asumsi bersama nilai tersebut. Jika memakai nilai di luar patokan, catat alasannya.</p>
            <div className="basics-surfaces">{Object.entries(coefficientGuidance).map(([id, item]) => <div key={id}><span className={`material-swatch ${id}`} /><div><strong>{surfaceLabels[id as keyof typeof surfaceLabels]}</strong><span>{item.ranges.length ? item.ranges.map(range => `${range.label}: ${range.low.toLocaleString("id-ID")}–${range.high.toLocaleString("id-ID")}`).join(" · ") : "Tidak ada satu rentang universal"}</span><a href={item.url} target="_blank" rel="noreferrer">{item.source}</a></div></div>)}</div>
            <p className="basics-caution"><Info size={20} />Patokan TxDOT berasal dari konteks debit puncak Rational Method. Di TIRTA ini hanya panduan pra-perencanaan, bukan C volumetrik yang telah dikalibrasi untuk persil Anda. Perkerasan berpori USGS tidak mewakili semua tanah berpori.</p>
          </>}
          {topic === "rainfall" && <>
            <p className="basics-lead">Hujan adalah kedalaman air yang diuji pada seluruh persil. Volume air bertambah ketika lahan lebih luas atau hujan lebih dalam.</p>
            <div className="basics-equation"><span>Luas lahan <b>A · m²</b></span><b>×</b><span>Hujan <b>P / 1.000 · m</b></span><b>=</b><span>Air jatuh <b>V hujan · m³</b></span></div>
            <div className="basics-equation"><span>Air jatuh <b>V hujan</b></span><b>×</b><span>Bagian limpasan <b>C · 0–1</b></span><b>=</b><span>Limpasan <b>V limpasan · m³</b></span></div>
            <h2>Skenario saya atau data hujan?</h2><p>Angka uji Anda dicatat sebagai asumsi tanpa sumber eksternal. Data dari stasiun atau dokumen memerlukan sumber. Kosong berbeda dari 0 mm.</p>
            <CalculationSource method="runoff" />
          </>}
          {topic === "interventions" && <>
            <p className="basics-lead">Tangki menampung air untuk penggunaan yang Anda rencanakan. Resapan, taman hujan, dan perlakuan berpori memerlukan bukti kapasitas dan kondisi pemasangan.</p>
            <div className="basics-water-ledger"><span>Limpasan awal</span><b>=</b><span>Ditampung</span><b>+</b><span>Dimanfaatkan</span><b>+</b><span>Diinfiltrasikan</span><b>+</b><span>Sisa</span></div>
            <h2>Air tidak dihitung dua kali</h2><p>Penanganan dibatasi kapasitas yang Anda nyatakan dan limpasan yang tersedia. Simbol pada sketsa bukan ukuran tampungan; kedekatan zona bukan hubungan aliran.</p>
            <h2>Mengapa masih perlu data?</h2><p>Biaya dan kapasitas saja belum membuktikan intervensi cocok untuk lokasi. Tinjauan ilmiah membedakan data belum cukup, layak dengan syarat, dan pilihan yang tidak sesuai.</p><CalculationSource method="ledger" />
          </>}
          {topic === "alternatives" && <>
            <p className="basics-lead">Paket dengan sisa limpasan terendah belum tentu paling murah atau paling hemat lahan. Bandingkan sesuai prioritas rencana.</p>
            <div className="basics-process"><span><Scale size={24} />Biaya</span><span><Layers size={24} />Lahan</span><span><Droplets size={24} />Sisa limpasan</span></div>
            <h2>Yang dibandingkan harus sebanding</h2><p>TIRTA memeriksa kombinasi opsi yang Anda isi sesuai batas rencana, tanpa skor berbobot. Bandingkan juga hasilnya pada hujan yang lebih berat.</p><CalculationSource method="pareto" />
          </>}
          {topic === 'methods' && <MethodGuide initial={method} />}
          {claim && <section className="basics-evidence"><h2>Bukti & batas penggunaan</h2><p>{claim.wording}</p><p className="quiet">{claim.limitations}</p><ScientificReference claimId={claim.id} label="Buka referensi terkait" /><ScientificReference label="Jelajahi seluruh referensi" /></section>}
          <p className="basics-caution"><Info size={20} />Estimasi pra-perencanaan. Bukan desain konstruksi, simulasi banjir, atau sertifikasi keselamatan.</p>
        </article>
      </div>
    </ContextDialog>}
  </HelpContext.Provider>;
}
