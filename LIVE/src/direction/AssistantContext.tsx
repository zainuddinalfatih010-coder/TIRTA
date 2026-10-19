import { useState, type ReactNode } from 'react';
import { ArrowRight, CloudRain, FolderOpen, Layers, RotateCcw, Scale, SlidersHorizontal, FileCheck } from 'lucide-react';
import { topicForStep, type AssistantStep, type AssistantTopic } from '../assistant/context';
import { readInput, type SourcedInput } from '../domain/planningAuthoring';
import { productionBaseline } from '../domain/productionBaseline';
import { evaluatePlan, familyLabels, planningFingerprint } from '../domain/planningEngine';
import type { ProjectV2 } from '../domain/projectV2';
import { Parcel, materials } from './Parcel';
import { componentEditorValues, fmt, money, type OptionId } from './productionBridge';
import { HelpButton } from './TirtaHelp';

const topics = {
  project: { label: 'Proyek', icon: FolderOpen, action: 'Buka proyek' },
  studio: { label: 'Persil & permukaan', icon: Layers, action: 'Buka Studio Persil' },
  rain: { label: 'Hujan & limpasan', icon: CloudRain, action: 'Buka Hujan' },
  interventions: { label: 'Intervensi', icon: SlidersHorizontal, action: 'Atur intervensi' },
  alternatives: { label: 'Paket & perbandingan', icon: Scale, action: 'Buka alternatif' },
  impact: { label: 'Rencana pilihan', icon: FileCheck, action: 'Buka Rencana & Dampak' },
};
type Props = {
  project: ProjectV2; scenario: string; originStep: AssistantStep; discussion: AssistantTopic | null;
  selectedZoneId: string; selectedInterventionId: string | null;
  interventionFamily: ProjectV2['components'][number]['family'] | null;
  packageContent: ReactNode; onReset: () => void; onTopic: (topic: AssistantTopic) => void;
  onNavigate: (step: AssistantStep) => void;
};

export function AssistantContext({ project, scenario, originStep, discussion, selectedZoneId, selectedInterventionId, interventionFamily, packageContent, onReset, onTopic, onNavigate }: Props) {
  const topic = discussion ?? topicForStep(originStep);
  const [inspectedZone, setInspectedZone] = useState(selectedZoneId);
  const [inspectedIntervention, setInspectedIntervention] = useState(selectedInterventionId ?? '');
  const item = topics[topic];
  const rain = project.scenarios.find(s => s.id === scenario);
  const baseline = productionBaseline(project, scenario);
  const zone = project.zones.find(z => z.id === inspectedZone);
  const familyAbsent = !!interventionFamily && !project.components.some(c => c.family === interventionFamily);
  const component = familyAbsent ? undefined : project.components.find(c => c.id === inspectedIntervention) ?? project.components.find(c => c.enabled);
  const values = component ? componentEditorValues(project, component.id as OptionId, scenario) : null;
  const parameter = (id: string | undefined) => project.parameters.find(p => p.id === id)?.value;
  const area = parameter(project.parcel?.area.id);
  const rainfallInput = readInput(project, rain?.rainfall, scenario);
  const rainfall = rainfallInput.text === '' ? null : Number(rainfallInput.text);
  const inputValue = (input: SourcedInput) => input.text === '' ? null : Number(input.text);
  const chosen = project.selectedPlan;
  const chosenStale = !!chosen && chosen.reviewedInputFingerprint !== planningFingerprint(project);
  const chosenResult = chosen && !chosenStale ? evaluatePlan(project, chosen.definition, scenario) : null;

  return <aside className="assistant-context" aria-label="Konteks proyek dan paket" data-topic={topic}>
    <section className="assistant-context-sheet">
      <header><div className="assistant-topic-heading"><item.icon size={18}/><span>{discussion ? 'Sedang dibahas' : 'Langkah sebelumnya'}<h2>{item.label}</h2></span></div></header>
      <div className="assistant-context-identity"><strong title={project.name}>{project.name}</strong><span>{project.zones.length} zona{area != null ? ` · ${fmt(area)} m²` : ''}</span></div>
      <div className="assistant-context-body" key={topic} tabIndex={0} role="region" aria-label={`Detail ${item.label}`}>
        {topic === 'rain' && <>
          <div className="assistant-context-hero"><span>{rain?.name ?? 'Hujan belum dipilih'}</span><strong>{rainfall == null ? 'Belum diketahui' : <>{fmt(rainfall)} <small>mm</small></>}</strong></div>
          {baseline.ok ? <div className="assistant-volume" aria-label="Volume hujan dan limpasan">
            <p>Air hujan di persil <strong>{fmt(baseline.value.rainfallM3)} m³</strong></p>
            <div className="assistant-volume-bar" aria-hidden="true">
              {baseline.value.rainfallM3 > 0 && <><span style={{ width: `${baseline.value.runoffM3 / baseline.value.rainfallM3 * 100}%` }}>{baseline.value.runoffM3 / baseline.value.rainfallM3 >= .28 && <><small>Limpasan awal</small><strong>{fmt(baseline.value.runoffM3)} m³</strong></>}</span><span style={{ width: `${baseline.value.nonRunoffM3 / baseline.value.rainfallM3 * 100}%` }}>{baseline.value.nonRunoffM3 / baseline.value.rainfallM3 >= .28 && <><small>Non-limpasan</small><strong>{fmt(baseline.value.nonRunoffM3)} m³</strong></>}</span></>}
            </div>
            <dl className={baseline.value.rainfallM3 > 0 && baseline.value.runoffM3 / baseline.value.rainfallM3 >= .28 && baseline.value.nonRunoffM3 / baseline.value.rainfallM3 >= .28 ? "sr-only" : "assistant-context-rows"}><div><dt><i className="runoff-dot"/>Limpasan awal</dt><dd>{fmt(baseline.value.runoffM3)} m³</dd></div><div><dt><i className="nonrunoff-dot"/>Non-limpasan</dt><dd>{fmt(baseline.value.nonRunoffM3)} m³</dd></div></dl>
            <p className="assistant-context-note">Non-limpasan bukan otomatis infiltrasi.</p>
            <div className="assistant-context-rows" aria-label="Kontribusi zona">{[...baseline.value.zones].sort((a, b) => b.runoffM3 - a.runoffM3).slice(0, 3).map(z => <div key={z.id}><span title={project.zones.find(x => x.id === z.id)?.name}>{project.zones.find(x => x.id === z.id)?.name}</span><strong>{fmt(z.runoffM3)} m³</strong></div>)}</div>
            {project.zones.length > 3 && <p className="assistant-context-note">Kontribusi terbesar; rincian semua zona tersedia di Hujan.</p>}
          </div> : <p className="assistant-missing">Perhitungan menunggu data persil, zona, atau hujan yang belum lengkap.</p>}
          <HelpButton topic="rainfall" label="Dasar hujan & limpasan"/>
        </>}
        {topic === 'studio' && <>
          {project.parcel && <div className="assistant-parcel"><Parcel project={project} selected={zone?.id ?? ''} compact fit materialTextures/></div>}
          <label className="assistant-context-select" htmlFor="assistant-zone">Zona yang ditinjau<select id="assistant-zone" value={zone?.id ?? ''} onChange={e => setInspectedZone(e.target.value)}><option value="">Ringkasan persil</option>{project.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
          {zone ? <dl className="assistant-context-rows"><div><dt>Permukaan</dt><dd>{zone.surface ? materials[zone.surface].label : 'Belum diketahui'}</dd></div><div><dt>Luas zona</dt><dd>{parameter(zone.area.id) == null ? 'Belum diketahui' : `${fmt(parameter(zone.area.id)!)} m²`}</dd></div><div><dt>Koefisien C</dt><dd>{parameter(zone.coefficient.id) == null ? 'Belum diketahui' : fmt(parameter(zone.coefficient.id)!)}</dd></div></dl> : <p className="assistant-context-note">{project.zones.length ? 'Pilih satu zona untuk melihat permukaan dan koefisiennya.' : 'Belum ada zona. Susun persil terlebih dahulu.'}</p>}
          <HelpButton topic="coefficient" label="Dasar permukaan & C"/>
        </>}
        {topic === 'interventions' && <>
          {project.parcel && <div className="assistant-parcel"><Parcel project={project} selected="" compact fit materialTextures enabled={project.components.filter(c => c.enabled).map(c => c.id as OptionId)}/></div>}
          {component && values ? <>
            <label className="assistant-context-select" htmlFor="assistant-intervention">Intervensi yang ditinjau<select id="assistant-intervention" value={component.id} onChange={e => setInspectedIntervention(e.target.value)}>{project.components.map(c => <option key={c.id} value={c.id}>{c.name}{c.enabled ? '' : ' · tidak aktif'}</option>)}</select></label>
            <dl className="assistant-context-rows"><div><dt>Kapasitas pada hujan aktif</dt><dd>{inputValue(values.capacity) == null ? 'Belum diketahui' : `${fmt(inputValue(values.capacity)!)} m³`}</dd></div><div><dt>Biaya</dt><dd>{inputValue(values.cost) == null ? 'Belum diketahui' : money(inputValue(values.cost)!)}</dd></div><div><dt>Lahan</dt><dd>{inputValue(values.area) == null ? 'Belum diketahui' : `${fmt(inputValue(values.area)!)} m²`}</dd></div></dl>
            <p className="assistant-context-note">{component.enabled ? 'Aktif dalam pencarian paket.' : 'Tidak aktif dalam pencarian paket.'} Kapasitas mengikuti skenario {rain?.name ?? 'yang dipilih'}.</p>
          </> : <p className="assistant-missing">{familyAbsent ? `${familyLabels[interventionFamily!]} belum ditambahkan ke proyek.` : 'Belum ada intervensi aktif untuk ditinjau.'} Kapasitas dan biaya tidak diisi otomatis.</p>}
          <button className="text-button" onClick={() => onTopic('alternatives')}>Tinjau paket dari pilihan ini<ArrowRight size={16}/></button><HelpButton topic="interventions" label="Dasar intervensi & neraca air"/>
        </>}
        {topic === 'alternatives' && packageContent}
        {topic === 'impact' && <>
          {chosen ? <><h3 className="assistant-composition">{chosen.definition.name}</h3>{project.parcel && <div className="assistant-parcel"><Parcel project={project} selected="" compact fit materialTextures enabled={chosen.definition.components.filter(c => c.enabled).map(c => c.id as OptionId)}/></div>}
            {chosenStale ? <p className="assistant-stale">Data berubah sejak rencana dipilih. Tinjau kembali sebelum menggunakan hasilnya.</p> : chosenResult?.ok ? <dl className="assistant-context-rows"><div><dt>Sisa limpasan</dt><dd>{fmt(chosenResult.value.residual)} m³</dd></div><div><dt>Biaya</dt><dd>{money(chosenResult.value.cost)}</dd></div><div><dt>Lahan</dt><dd>{fmt(chosenResult.value.area)} m²</dd></div></dl> : <p className="assistant-missing">Rencana belum dapat dihitung pada hujan aktif.</p>}
          </> : <p className="assistant-missing">Belum ada rencana pilihan. Tinjau dan pilih paket terlebih dahulu.</p>}
          <HelpButton topic="alternatives" label="Dasar pemilihan rencana"/>
        </>}
        {topic === 'project' && <>
          {project.parcel && <div className="assistant-parcel"><Parcel project={project} selected="" compact fit materialTextures/></div>}<dl className="assistant-context-rows"><div><dt>Luas persil</dt><dd>{area == null ? 'Belum diketahui' : `${fmt(area)} m²`}</dd></div><div><dt>Zona</dt><dd>{project.zones.length}</dd></div><div><dt>Skenario hujan</dt><dd>{project.scenarios.length}</dd></div><div><dt>Rencana pilihan</dt><dd>{chosen?.definition.name ?? 'Belum dipilih'}</dd></div></dl><p className="assistant-context-note">Simpanan ada di browser perangkat ini. Cadangan membantu memindahkan proyek.</p>
        </>}
      </div>
      <footer className="assistant-context-footer">
        {topic !== 'alternatives' && <button className="assistant-context-open" onClick={() => onNavigate(topic)}>{item.action}<ArrowRight size={16}/></button>}
        {discussion && <button className="text-button assistant-context-reset" onClick={onReset}><RotateCcw size={14}/>Kembali ke konteks langkah</button>}
        {project.mode === 'demo' && <small>Contoh sintetis · bukan hasil ukur lapangan.</small>}
      </footer>
    </section>
  </aside>;
}
