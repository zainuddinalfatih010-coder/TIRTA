import { useRef, useState } from 'react';
import type { ProjectV2 } from '../domain/projectV2';
import type { FieldObservation } from '../domain/scientificContract';
import { fieldObservationGuidance, fieldObservationLabels, recordFieldObservation } from '../domain/fieldObservations';
import './FieldObservationControl.css';

/** Optional field context; no new numerical input and no claim of site certification. */
export function FieldObservationControl({ project, zoneId, onProject }: { project: ProjectV2; zoneId: string; onProject: (p: ProjectV2) => void }) {
  const observed = project.science?.surfaces[zoneId]?.fieldObservation ?? { condition: 'unknown' as const, note: '' };
  const [editingNote, setEditingNote] = useState(false);
  const [error, setError] = useState('');
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const guidance = fieldObservationGuidance(project, [zoneId]);
  const save = (observation: FieldObservation) => {
    try { onProject(recordFieldObservation(project, zoneId, observation)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Catatan belum tersimpan.'); }
  };
  return <section className="field-observation-control" aria-label="Pengamatan area">
    <label>Kondisi yang pernah Anda lihat
      <select aria-label="Kondisi yang pernah Anda lihat" value={observed.condition} onChange={e => save({ condition: e.target.value as FieldObservation['condition'], note: noteInput.current?.value ?? observed.note })}>
        {Object.entries(fieldObservationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {guidance && <p>{guidance.nextQuestion}</p>}
    {observed.condition !== 'unknown' && <>
      {!editingNote && !observed.note ? <button type="button" className="text-button" onClick={() => setEditingNote(true)}>Tambahkan catatan</button>
        : <label>Catatan singkat<textarea ref={noteInput} key={`${zoneId}-${observed.condition}`} aria-label="Catatan pengamatan area" defaultValue={observed.note} maxLength={500} rows={2} onBlur={e => { if (e.target.value.trim() !== observed.note) save({ ...observed, note: e.target.value }); }} placeholder="Misalnya: air tertahan dekat pintu setelah hujan." /></label>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
