import { useState } from 'react';
import { overflowChoices } from '../domain/treatmentLifecycle';
import type { ProjectV2 } from '../domain/projectV2';
import { emptyInterventionEvidence, interventionEvidenceSchema, destinationSchema } from '../domain/scientificContract';
import { updateScience, scientificScenarioContext } from '../domain/scientificAuthoring';
import { assessIntervention, feasibilityLabels } from '../domain/feasibility';
import { routingIssues } from '../domain/sourceRouting';
import { referencedSoil } from '../domain/treatmentDesign';
import { ContextDialog } from './ContextDialog';
import { ScientificReference } from './ScientificReference';
import { HelpButton } from './TirtaHelp';
import { ScientificNumberFields, numberFromForm, TextField, ChoiceField, formText } from './ScientificInputs';
const yesNoUnknown = { unknown: 'Belum diperiksa', suitable: 'Dinyatakan sesuai', unsuitable: 'Dinyatakan tidak sesuai' };
const performanceOrigins = { unknown: 'Belum diketahui', measured: 'Pengukuran kinerja', 'design-declared': 'Deklarasi desain', 'literature-guided': 'Panduan literatur yang sesuai', 'user-entered': 'Asumsi pengguna' };
export function InterventionScience({ project, id, scenarioId, onProject, includeResources = true, staged = false }: { staged?: boolean; project: ProjectV2; id: string; scenarioId: string; onProject: (p: ProjectV2) => void; includeResources?: boolean }) {
  const [open, setOpen] = useState(false), [task, setTask] = useState<'performance' | 'site' | 'connection'>('performance'), [error, setError] = useState('');
  const [origin, setOrigin] = useState('unknown'), [groundwater, setGroundwater] = useState('unknown'), [useSoilReference, setUseSoilReference] = useState(false);
  const [soilChanged, setSoilChanged] = useState(false);
  const c = project.components.find(c => c.id === id)!;
  const evidence = project.science?.interventions[id] ?? emptyInterventionEvidence();
  const f = assessIntervention(project, c, scenarioId, project.parameters, undefined, includeResources);
  const perf = c.performanceByScenario[scenarioId];
  const baseRef = perf && ('availableStorage' in perf ? perf.availableStorage : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity : perf.additionalInfiltrationCapacity);
  const ref = baseRef && (project.scenarios.find(s => s.id === scenarioId)?.overrides.find(o => o.baseParameterId === baseRef.id)?.replacement ?? baseRef);
  const parameter = project.parameters.find(p => p.id === ref?.id);
  const basis = evidence.performance[scenarioId];
  const soil = referencedSoil(project, c, evidence);
  const hasSoilReference = !!evidence.soilReference && !soil.stale;
  const basisCurrent = !!basis && basis.origin !== 'unknown' && !!basis.source.trim() && basis.parameterId === parameter?.id && basis.parameterRevision === parameter?.revision && (c.family === 'storage' || (basis.rainfallMm === scientificScenarioContext(project, scenarioId).rainfallMm && basis.durationMinutes === scientificScenarioContext(project, scenarioId).durationMinutes));
  const formId = `intervention-science-${id}`;
  const soilNeeded = c.family === 'infiltration' || c.family === 'rain-garden' || (c.family === 'permeable' && basis?.subgradeDependent !== false);
  const recipients = overflowChoices(project,id,scenarioId);
  const invalidOverflow = evidence.overflow.kind === 'intervention' && !recipients.some(other=>evidence.overflow.kind==='intervention'&&other.id===evidence.overflow.id);
  const unavailableOverflow = invalidOverflow && evidence.overflow.kind==='intervention' ? { [`intervention:${evidence.overflow.id}`]: 'Tujuan sebelumnya perlu diperiksa' } : {};
  return <><button className="text-button option-config-trigger" aria-label={`${feasibilityLabels[f.status]} · tinjau dasar`} onClick={() => { setOrigin(basis?.origin ?? 'unknown'); setGroundwater(evidence.groundwaterAssessment); setUseSoilReference(hasSoilReference); setSoilChanged(false); setError(''); setOpen(true); }}>Tinjau dasar</button>
    {open && <ContextDialog className="intervention-review" title={`Kelayakan ${c.name}`} onClose={() => setOpen(false)} footer={<><button type="submit" className="primary" form={formId}>Simpan tinjauan</button>{staged&&<small>Tinjauan masuk ke isian ini. Tekan Simpan penanganan untuk menerapkannya ke proyek.</small>}</>}>
      <strong>{feasibilityLabels[f.status]}</strong>
      {[...f.reasons, ...f.missing].length > 0 && <details className="review-issues" open={f.reasons.length > 0}><summary>{f.reasons.length ? 'Masalah yang perlu diperbaiki' : `${f.missing.length} data belum lengkap`}</summary><ul>{[...f.reasons, ...f.missing].map(x => <li key={`${x.ruleId}:${x.message}`}>{x.message}</li>)}</ul></details>}
      <div className="scientific-task-switch" role="group" aria-label="Bagian tinjauan">{([['performance', 'Dasar kapasitas'], ['site', 'Kondisi lokasi'], ['connection', 'Sumber & luapan']] as const).map(([key, label]) => <button key={key} aria-pressed={task === key} onClick={() => { setTask(key); setError(''); }}>{label}</button>)}</div>
      <form id={formId} onChange={e => { const input = e.target; if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) { if (input.name.startsWith('soil')) setSoilChanged(true); if (input.name === 'origin') setOrigin(input.value); if (input.name === 'groundwaterAssessment') setGroundwater(input.value); } }} onInvalidCapture={e => { const field = e.target as HTMLElement; const section = field.closest<HTMLElement>('[data-section]')?.dataset.section; if (section) setTask(section as typeof task); for (let node = field.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true; }} onSubmit={e => { e.preventDefault(); try {
        const data = new FormData(e.currentTarget), next = structuredClone(evidence);
        {
          if (parameter && parameter.value !== null) next.performance[scenarioId] = { origin: formText(data, 'origin') as 'unknown', source: formText(data, 'performanceSource'), subgradeDependent: c.family === 'permeable' ? formText(data, 'subgradeDependent') === 'unknown' ? null : formText(data, 'subgradeDependent') === 'yes' : null, parameterId: parameter.id, parameterRevision: parameter.revision, ...scientificScenarioContext(project, scenarioId), method: formText(data, 'performanceMethod'), date: formText(data, 'performanceDate') };
          if (c.family === 'storage') next.nominalTankCapacity = numberFromForm(data, 'nominal', 'm3');
          if (c.family === 'permeable') { next.system = formText(data, 'system'); next.specification = formText(data, 'specification'); }
          if (c.family === 'rain-garden') { next.media = formText(data, 'media'); next.vegetation = formText(data, 'vegetation'); }
        }
        {
          if (soilNeeded) {
            // Collapsing or saving another section must not silently replace a stale zone observation.
            if (!useSoilReference && (!soil.stale || soilChanged)) { delete next.soilReference; next.soilInfiltration = numberFromForm(data, 'soil', 'mm/h'); }
            next.groundwaterDepth = numberFromForm(data, 'groundwater', 'm');
            next.groundwaterAssessment = formText(data, 'groundwaterAssessment') as typeof next.groundwaterAssessment; next.groundwaterBasis = formText(data, 'groundwaterBasis');
            next.localStandardReview = formText(data, 'standardReview') as typeof next.localStandardReview; next.localStandardBasis = formText(data, 'standardBasis');
          }
          if (c.family === 'permeable') { next.subgrade = formText(data, 'subgrade') as typeof next.subgrade; next.subgradeBasis = formText(data, 'subgradeBasis'); }
          next.fieldVerified = formText(data, 'fieldVerified') === 'unknown' ? null : formText(data, 'fieldVerified') === 'yes'; next.verificationSource = formText(data, 'verificationSource');
          next.maintenance = formText(data, 'maintenance'); next.condition = formText(data, 'condition') as typeof next.condition;
        }
        {
          const overflow = formText(data, 'overflow');
          next.overflow = destinationSchema.parse(overflow.startsWith('zone:') ? { kind: 'zone', id: overflow.slice(5) } : overflow.startsWith('intervention:') ? { kind: 'intervention', id: overflow.slice(13) } : overflow === 'outside' || overflow === 'drainage' ? { kind: overflow, note: formText(data, 'overflowSource') } : { kind: 'unknown' });
        }
        const checked = interventionEvidenceSchema.parse(next);
        const updated = updateScience(project, s => {
          s.interventions[id] = checked; s.legacyNeedsVerification = s.legacyNeedsVerification.filter(key => key !== id);
          if (c.family !== 'permeable' && !c.treatment) {
            s.connections = s.connections.filter(link => link.candidateId !== id);
            for (const zoneId of c.targets) {
              const declared = data.getAll('connected').includes(zoneId);
              s.connections.push({ id: `candidate-${id}-${zoneId}`, candidateId: id, sourceZoneId: zoneId, destination: declared ? { kind: 'intervention', id } : { kind: 'unknown' }, via: formText(data, 'via') as 'unknown', origin: declared ? 'user_supplied' : 'unknown', source: formText(data, 'connectionSource') });
            }
          }
        });
        const issues = routingIssues(updated); if (issues.length) throw new Error(issues.join(' '));
        onProject(updated); setError(''); setOpen(false);
      } catch { setError('Periksa dasar angka dan hubungan sumber. Pengukuran perlu metode/tanggal; hubungan yang diketahui perlu sumber. Angka tidak diisi otomatis.'); } }}>
        <fieldset data-section="performance" hidden={task !== 'performance'} className="science-section">
          <p className="review-capacity">Kapasitas: <strong>{parameter?.value === null || parameter?.value === undefined ? 'belum diketahui' : `${new Intl.NumberFormat('id-ID').format(parameter.value)} m³/kejadian`}</strong></p>
          <details className="review-details" open={!basisCurrent || origin === 'measured'}><summary>{basisCurrent ? `Dasar kapasitas: ${performanceOrigins[basis!.origin]}` : 'Isi dasar kapasitas'}</summary><div>
            <ChoiceField name="origin" label="Asal kinerja per kejadian" value={basis?.origin ?? 'unknown'} choices={performanceOrigins} /><TextField name="performanceSource" label="Dasar kapasitas" value={basis?.source} />
            <div hidden={origin !== 'measured'} className="review-measurement"><label>Metode pengukuran<input name="performanceMethod" defaultValue={basis?.method ?? ''} maxLength={2000} required={origin === 'measured'} /></label><label>Tanggal pengukuran<input name="performanceDate" type="date" defaultValue={basis?.date ?? ''} required={origin === 'measured'} /></label></div>
          </div></details>
          <HelpButton topic="methods" method={c.family === 'storage' ? 'storage' : c.family === 'infiltration' ? 'infiltration' : c.family === 'rain-garden' ? 'garden' : 'permeable'} label="Dasar metode" />
          {c.family === 'storage' && <details className="review-details"><summary>Ukuran tangki</summary><div><ScientificNumberFields name="nominal" label="Kapasitas nominal tangki" initial={evidence.nominalTankCapacity} /><ScientificReference claimId="CLAIM-STORAGE" /></div></details>}
          {c.family === 'permeable' && <><TextField name="system" label="Sistem konversi berpori" value={evidence.system} /><TextField name="specification" label="Spesifikasi / lapisan dan dasar kinerja" value={evidence.specification} /><ChoiceField name="subgradeDependent" label="Kinerja bergantung pada resapan tanah dasar?" value={basis?.subgradeDependent === null || basis?.subgradeDependent === undefined ? 'unknown' : basis.subgradeDependent ? 'yes' : 'no'} choices={{ unknown: 'Belum diketahui', yes: 'Ya', no: 'Tidak, ada dasar sistem independen' }} /><ScientificReference claimId="CLAIM-POROUS" /></>}
          {c.family === 'rain-garden' && <details className="review-details"><summary>Media dan tanaman</summary><div><TextField name="media" label="Rencana media / tanah" value={evidence.media} /><TextField name="vegetation" label="Tanaman yang direncanakan" value={evidence.vegetation} /><ScientificReference claimId="CLAIM-BIO-MEDIA" /></div></details>}
        </fieldset>
        <fieldset data-section="site" hidden={task !== 'site'} className="science-section">
          {soilNeeded && <>
            {soil.stale && <p className="field-error">Data tanah zona berubah. Konfirmasikan kembali melalui Kapasitas, atau isi data lokasi ini.</p>}
            {hasSoilReference && <div className="review-soil-reference"><strong>{project.zones.find(z => z.id === evidence.soilReference!.zoneId)?.name}: {soil.number?.value} mm/jam</strong><p>Data tanah zona sudah dikonfirmasi untuk lokasi ini.</p><label className="check-line"><input type="checkbox" checked={useSoilReference} onChange={e => setUseSoilReference(e.target.checked)} />Gunakan data tanah zona</label></div>}
            <fieldset hidden={useSoilReference} disabled={useSoilReference} className="review-direct-soil"><details className="review-details" open={evidence.soilInfiltration.value === null || soil.stale}><summary>{evidence.soilInfiltration.value === null ? 'Isi bukti infiltrasi tanah' : `Data tanah: ${new Intl.NumberFormat('id-ID').format(evidence.soilInfiltration.value)} mm/jam`}</summary><div><ScientificNumberFields name="soil" label="Bukti infiltrasi tanah" initial={evidence.soilInfiltration} /><ScientificReference claimId="CLAIM-SOIL" /></div></details></fieldset>
            <ChoiceField name="groundwaterAssessment" label="Kesesuaian terhadap kondisi air tanah" value={evidence.groundwaterAssessment} choices={{ ...yesNoUnknown, 'not-applicable': 'Dinyatakan tidak berlaku dengan dasar' }} />
            <div hidden={groundwater === 'unknown'}><TextField name="groundwaterBasis" label="Dasar tinjauan air tanah / ketidakberlakuan" value={evidence.groundwaterBasis} /></div>
            {groundwater === 'unknown' && <small>Isian dapat disimpan. Dampak resapan menunggu pemeriksaan air tanah.</small>}
          </>}
          {c.family === 'permeable' && <><ChoiceField name="subgrade" label="Kesesuaian tanah dasar" value={evidence.subgrade} choices={yesNoUnknown} /><TextField name="subgradeBasis" label="Dasar tanah dasar" value={evidence.subgradeBasis} /></>}
          <details className="review-details" open={evidence.localStandardReview === 'failed' || evidence.condition === 'damaged' || evidence.condition === 'clogged'}><summary>Rincian pelaksanaan</summary><div>
            {soilNeeded && <><ScientificNumberFields name="groundwater" label="Kedalaman air tanah" initial={evidence.groundwaterDepth} /><ChoiceField name="standardReview" label="Persyaratan setempat" value={evidence.localStandardReview} choices={{ unknown: 'Belum ditinjau', reviewed: 'Sudah ditinjau untuk pra-perencanaan', failed: 'Tidak memenuhi tinjauan' }} /><TextField name="standardBasis" label="Dasar tinjauan persyaratan" value={evidence.localStandardBasis} /><ScientificReference claimId="CLAIM-GROUNDWATER" /></>}
            <ChoiceField name="fieldVerified" label="Pemeriksaan lokasi" value={evidence.fieldVerified === null ? 'unknown' : evidence.fieldVerified ? 'yes' : 'no'} choices={{ unknown: 'Belum diketahui', yes: 'Sudah, dengan catatan', no: 'Belum' }} /><TextField name="verificationSource" label="Catatan pemeriksaan" value={evidence.verificationSource} /><TextField name="maintenance" label="Pemeliharaan" value={evidence.maintenance} /><ChoiceField name="condition" label="Kondisi instalasi yang sudah ada" value={evidence.condition} choices={{ unknown: 'Belum diketahui / belum dipasang', maintained: 'Terawat', clogged: 'Tersumbat', damaged: 'Rusak' }} /><ScientificReference claimId="CLAIM-MAINTENANCE" />
          </div></details>
        </fieldset>
        <fieldset data-section="connection" hidden={task !== 'connection'} className="science-section">
          <p>{c.treatment ? 'Sumber dan jalur menggunakan isian pada langkah Hubungan.' : 'Pilih sumber dan jalur air yang direncanakan.'}</p>
          {c.family !== 'permeable' && c.targets.map(zoneId => { const declared = project.science?.connections.some(link => link.candidateId === id && link.sourceZoneId === zoneId && link.destination.kind === 'intervention' && link.destination.id === id); return c.treatment ? <p key={zoneId}>{declared && <input type="hidden" name="connected" value={zoneId}/>} {project.zones.find(z => z.id === zoneId)?.name} → {c.name} · {declared ? 'rencana dinyatakan' : 'jalur belum dinyatakan; lengkapi pada Hubungan'}</p> : <label className="check-row" key={zoneId}><input type="checkbox" name="connected" value={zoneId} defaultChecked={declared}/>{project.zones.find(z => z.id === zoneId)?.name} → {c.name}</label>; })}
          {c.family !== 'permeable' && !c.treatment && <><ChoiceField name="via" label="Jalur yang direncanakan" value={project.science?.connections.find(link => link.candidateId === id)?.via ?? 'unknown'} choices={{ unknown: 'Belum diketahui', 'gutter-downpipe': 'Talang / pipa turun', edge: 'Tepi permukaan', drain: 'Saluran', other: 'Jalur lain yang dinyatakan' }} /><TextField name="connectionSource" label="Dasar sambungan / rute rencana" value={project.science?.connections.find(link => link.candidateId === id)?.source} /></>}
          <ChoiceField name="overflow" label="Tujuan luapan" value={evidence.overflow.kind === 'zone' || evidence.overflow.kind === 'intervention' ? `${evidence.overflow.kind}:${evidence.overflow.id}` : evidence.overflow.kind} choices={{ unknown: 'Belum diketahui', drainage: 'Saluran', outside: 'Keluar persil', ...Object.fromEntries(project.zones.map(z => [`zone:${z.id}`, z.name])), ...Object.fromEntries(recipients.map(other => [`intervention:${other.id}`, other.name])), ...unavailableOverflow }} />{invalidOverflow&&<p className="field-error" role="alert">Tujuan luapan sebelumnya tidak tersedia untuk rencana ini. Pilih tujuan aktif yang sesuai atau nyatakan belum diketahui.</p>}<TextField name="overflowSource" label="Catatan tujuan luapan" value={'note' in evidence.overflow ? evidence.overflow.note : ''} /><ScientificReference claimId="CLAIM-CONNECTION" />
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
      {f.conditions.length > 0 && <details className="review-details"><summary>Catatan sebelum pemasangan</summary><ul>{f.conditions.map(x => <li key={`${x.ruleId}:${x.message}`}>{x.message}</li>)}</ul><p className="quiet">Tinjauan pra-perencanaan, bukan persetujuan konstruksi.</p></details>}
    </ContextDialog>}
  </>;
}
