import { useState } from 'react';
import type { ScientificNumber } from '../domain/scientificContract';
import { observedNumber } from '../domain/scientificAuthoring';
const origins = { unknown: 'Belum diketahui', measured: 'Pengukuran', user_supplied: 'Data / asumsi saya', literature_guidance: 'Panduan literatur', derived: 'Hasil turunan dengan dasar', legacy_fixture: 'Angka contoh lama' };
export function ScientificNumberFields({ name, label, initial }: { name: string; label: string; initial: ScientificNumber }) {
  const [origin, setOrigin] = useState(initial.origin);
  return <fieldset className="scientific-number"><legend>{label} ({initial.unit === 'minutes' ? 'menit' : initial.unit === 'm3' ? 'm³' : initial.unit === 'degrees' ? '°' : initial.unit})</legend>
    <label>Angka<input aria-label={label} name={name} type="number" min="0" step="any" defaultValue={initial.value ?? ''} placeholder="Belum diketahui" /></label>
    <label>Dasar angka<select aria-label={`Dasar ${label}`} name={`${name}Origin`} value={origin} onChange={e => setOrigin(e.target.value as ScientificNumber['origin'])}>{Object.entries(origins).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Sumber / alasan<input name={`${name}Source`} defaultValue={initial.source} maxLength={2000} placeholder="Diisi untuk angka yang diketahui" /></label>
    {origin === 'measured' && <><label>Metode pengukuran<input name={`${name}Method`} defaultValue={initial.method} maxLength={2000} required /></label><label>Tanggal pengukuran<input name={`${name}Date`} type="date" defaultValue={initial.date} required /></label></>}
  </fieldset>;
}
export function numberFromForm(f: FormData, name: string, unit: ScientificNumber['unit']) {
  const raw = String(f.get(name) ?? '');
  const origin = String(f.get(`${name}Origin`) ?? 'unknown') as ScientificNumber['origin'];
  return observedNumber(raw, unit, origin, String(f.get(`${name}Source`) ?? ''), String(f.get(`${name}Method`) ?? ''), String(f.get(`${name}Date`) ?? ''));
}
export function TextField({ name, label, value = '' }: { name: string; label: string; value?: string }) {
  return <label>{label}<input name={name} defaultValue={value} maxLength={2000} placeholder="Belum diketahui" /></label>;
}
export function ChoiceField({ name, label, value, choices }: { name: string; label: string; value: string; choices: Record<string, string> }) {
  return <label>{label}<select aria-label={label} name={name} defaultValue={value}>{Object.entries(choices).map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}
export const formText = (f: FormData, name: string) => String(f.get(name) ?? '').trim();
