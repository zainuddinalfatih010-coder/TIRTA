import { useState } from 'react';
import { ZodError } from 'zod';
import type { ProjectV2 } from '../domain/projectV2';
import { blankFieldEvaluation, assessFieldEvaluation, fieldNextActions } from '../domain/fieldEvaluation';
import { fieldEvaluationSchema, type FieldEvaluation } from '../domain/scientificContract';
import { updateScience } from '../domain/scientificAuthoring';
import { ContextDialog } from './ContextDialog';
import { ScientificReference } from './ScientificReference';
import { ScientificNumberFields, numberFromForm, TextField, ChoiceField, formText } from './ScientificInputs';
export function FieldEvaluationPanel({ project, onProject, onNavigate }: { project: ProjectV2; onProject: (p: ProjectV2) => void; onNavigate?: (step: 'rain' | 'interventions' | 'compare') => void }) {
  const [draft, setDraft] = useState<FieldEvaluation | null>(null), [task, setTask] = useState<'before' | 'after' | 'installation'>('before'), [error, setError] = useState('');
  const plan = project.selectedPlan?.definition;
  if (!plan) return null;
  const records = project.science?.observations.filter(v => v.planId === plan.id) ?? [];
  const open = (value: FieldEvaluation) => { setDraft(structuredClone(value)); setTask('before'); setError(''); };
  const close = () => { setDraft(null); };
  const event = draft && task !== 'installation' ? draft[task] : null;
  const readSection = (form: HTMLFormElement): FieldEvaluation => {
    const f = new FormData(form), next = structuredClone(draft!);
    if (task !== 'installation') next[task] = { date: formText(f, 'eventDate'), rain: numberFromForm(f, 'eventRain', 'mm'), duration: numberFromForm(f, 'eventDuration', 'minutes'), ponding: formText(f, 'ponding') as typeof next.before.ponding, locations: formText(f, 'locations'), pondingDuration: numberFromForm(f, 'pondingDuration', 'minutes'), note: formText(f, 'note'), photo: next[task].photo };
    else { next.comparable = formText(f, 'comparable') === 'unknown' ? null : formText(f, 'comparable') === 'yes'; next.comparisonBasis = formText(f, 'comparisonBasis'); next.installedAsPlanned = formText(f, 'installed') === 'unknown' ? null : formText(f, 'installed') === 'yes'; next.installationNote = formText(f, 'installationNote'); next.maintenance = formText(f, 'maintenance'); next.condition = formText(f, 'condition') as typeof next.condition; }
    return fieldEvaluationSchema.parse(next);
  };
  const changeTask = (next: typeof task) => {
    try { const form = document.getElementById('field-evaluation'); if (form instanceof HTMLFormElement) setDraft(readSection(form)); setTask(next); setError(''); }
    catch { setError('Periksa angka/sumber bagian ini sebelum berpindah. Isian tetap ada.'); }
  };
  return <section className="field-evaluation">
    <h3>Evaluasi setelah pemasangan</h3><p className="quiet">Catat kondisi lapangan, terpisah dari estimasi model. Satu pasangan hujan tidak membuktikan sebab-akibat.</p>
    <button className="text-button" disabled={(project.science?.observations.length ?? 0) >= 20} onClick={() => open(blankFieldEvaluation(crypto.randomUUID(), plan.id, plan.revision))}>Catat sebelum & sesudah</button>
    {records.map(v => { const assessment = assessFieldEvaluation(v); return <div className="field-observation-row" key={v.id}><button className="text-button" onClick={() => open(v)}>{v.before.date || 'Tanggal belum diisi'} → {v.after.date || 'Tanggal belum diisi'} · {assessment.label}</button><p className="quiet">{assessment.explanation}{v.planRevision !== plan.revision && ' Catatan berasal dari revisi rencana yang berbeda.'}</p><div className="field-followups">{fieldNextActions(v).map(action => <button className="text-button" key={action.label} title={action.reason} onClick={() => onNavigate?.(action.step)}>{action.label} →</button>)}</div><button className="text-button" onClick={() => { if (window.confirm('Hapus catatan evaluasi ini?')) onProject(updateScience(project, s => { s.observations = s.observations.filter(x => x.id !== v.id); })); }}>Hapus catatan</button></div>; })}
    <ScientificReference claimId="CLAIM-FIELD" />
    {draft && <ContextDialog title="Pengamatan lapangan" onClose={close} footer={<button className="primary" type="submit" form="field-evaluation">Simpan catatan</button>}>
      <div className="scientific-task-switch" role="group" aria-label="Bagian pengamatan">{([['before', 'Sebelum'], ['after', 'Sesudah'], ['installation', 'Pemasangan & konteks']] as const).map(([key, label]) => <button key={key} aria-pressed={task === key} onClick={() => changeTask(key)}>{label}</button>)}</div>
      <p className="quiet">Isian dipertahankan saat berpindah bagian. Simpan catatan setelah selesai; kosong tetap belum diketahui.</p>
      <form id="field-evaluation" key={task} onSubmit={e => { e.preventDefault(); try {
        const checked = readSection(e.currentTarget);
        onProject(updateScience(project, s => { const index = s.observations.findIndex(v => v.id === checked.id); if (index >= 0) s.observations[index] = checked; else s.observations.push(checked); }));
        setDraft(checked); setError('Catatan disimpan. Anda dapat berpindah bagian atau menutup dialog.');
      } catch (cause) { setError(cause instanceof ZodError && cause.issues.some(issue => issue.message === 'Tanggal sesudah tidak boleh mendahului tanggal sebelum.') ? 'Tanggal sesudah tidak boleh mendahului tanggal sebelum. Perbaiki tanggal di bagian Sesudah; isian Anda tetap ada.' : 'Periksa angka, sumber, metode/tanggal pengukuran dan foto (maksimal 2 MB). Isian Anda tetap ada.'); } }}>
        {event && <>
          <label>Tanggal kejadian<input name="eventDate" type="date" defaultValue={event.date} /></label>
          <ScientificNumberFields name="eventRain" label="Hujan yang diamati" initial={event.rain} />
          <ScientificNumberFields name="eventDuration" label="Durasi kejadian" initial={event.duration} />
          <ChoiceField name="ponding" label="Genangan yang diamati" value={event.ponding} choices={{ unknown: 'Belum diketahui', observed: 'Ada genangan', 'not-observed': 'Tidak teramati genangan' }} />
          <TextField name="locations" label="Lokasi pengamatan" value={event.locations} /><ScientificNumberFields name="pondingDuration" label="Durasi genangan" initial={event.pondingDuration} /><TextField name="note" label="Catatan kondisi / metode pengamatan" value={event.note} />
          <label>Foto (maksimal 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Gunakan PNG/JPG/WebP maksimal 2 MB.'); e.target.value = ''; return; } const reader = new FileReader(); reader.onload = () => { const data = String(reader.result); const id = draft.id; if (task !== 'installation') setDraft(current => current?.id === id ? { ...current, [task]: { ...current[task], photo: data } } : current); }; reader.readAsDataURL(file); }} /></label>
          {event.photo && <><img className="field-photo" src={event.photo} alt={`Foto pengamatan ${task === 'before' ? 'sebelum' : 'sesudah'}`} /><button type="button" className="text-button" onClick={() => { if (task !== 'installation') setDraft({ ...draft, [task]: { ...draft[task], photo: '' } }); }}>Lepas foto</button></>}
        </>}
        {task === 'installation' && <>
          <ChoiceField name="comparable" label="Kejadian dapat dibandingkan?" value={draft.comparable === null ? 'unknown' : draft.comparable ? 'yes' : 'no'} choices={{ unknown: 'Belum dinilai', yes: 'Ya, dengan dasar yang dicatat', no: 'Tidak' }} /><TextField name="comparisonBasis" label="Dasar keterbandingan (hujan, kondisi awal, metode)" value={draft.comparisonBasis} />
          <ChoiceField name="installed" label="Terpasang sesuai rencana?" value={draft.installedAsPlanned === null ? 'unknown' : draft.installedAsPlanned ? 'yes' : 'no'} choices={{ unknown: 'Belum diketahui', yes: 'Ya, dengan catatan', no: 'Ada perbedaan' }} /><TextField name="installationNote" label="Catatan pemasangan" value={draft.installationNote} /><TextField name="maintenance" label="Pemeliharaan yang dilakukan" value={draft.maintenance} /><ChoiceField name="condition" label="Kondisi instalasi" value={draft.condition} choices={{ unknown: 'Belum diketahui', maintained: 'Terawat', clogged: 'Tersumbat', damaged: 'Rusak' }} />
        </>}
        {error && <p role="status">{error}</p>}
      </form>
      <p><strong>{assessFieldEvaluation(draft).label}</strong> · {assessFieldEvaluation(draft).explanation}</p>
    </ContextDialog>}
  </section>;
}
