import {invalidateRoofRouting,roofRoutingMeaning} from '../domain/roofRouting';
import { useState } from 'react';
import type { ProjectV2 } from '../domain/projectV2';
import { emptySurfaceContext, surfaceContextSchema, destinationSchema } from '../domain/scientificContract';
import { updateScience, rainfallAverageIntensity } from '../domain/scientificAuthoring';
import { routingIssues } from '../domain/sourceRouting';
import { ContextDialog } from './ContextDialog';
import { ScientificReference } from './ScientificReference';
import { ScientificNumberFields, numberFromForm, TextField, ChoiceField, formText } from './ScientificInputs';
import { unknownNumber } from '../domain/scientificContract';
import { porousConsistency } from '../domain/treatmentDesign';
export function SurfaceScience({ project, zoneId, onProject }: { project: ProjectV2; zoneId: string; onProject: (p: ProjectV2) => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  const zone = project.zones.find(z => z.id === zoneId)!;
  const context = project.science?.surfaces[zoneId] ?? emptySurfaceContext();
  const route = project.science?.connections.find(c => c.sourceZoneId === zoneId && !c.candidateId);
  const recipients = project.components.filter(c => c.enabled && c.family !== 'permeable');
  const destinationValue = route?.destination.kind === 'zone' || route?.destination.kind === 'intervention' ? `${route.destination.kind}:${route.destination.id}` : route?.destination.kind ?? 'unknown';
  const recipientId = route?.destination.kind === 'intervention' ? route.destination.id : null;
  const invalidRecipient = recipientId !== null && !recipients.some(c => c.id === recipientId);
  const previousRecipient = recipientId !== null ? project.components.find(c => c.id === recipientId)?.name ?? 'Penanganan yang tidak tersedia' : '';
  const destinationChoices = { unknown: 'Belum diketahui', drainage: 'Saluran', outside: 'Keluar persil', ...Object.fromEntries(project.zones.filter(z => z.id !== zoneId).map(z => [`zone:${z.id}`, z.name])), ...Object.fromEntries(recipients.map(c => [`intervention:${c.id}`, c.name])) };
  const formId = `surface-science-${zoneId}`;
  return <><button className="text-button" onClick={() => setOpen(true)}>Kondisi permukaan & tujuan air</button>
    {porousConsistency(project, zoneId).map(message => <p className="field-warning" key={message}>{message}</p>)}
    {open && <ContextDialog title={`Konteks ${zone.name}`} className="surface-context-dialog" onClose={() => setOpen(false)} footer={<button className="primary" type="submit" form={formId}>Simpan konteks</button>}>
      <p className="quiet">Data tambahan untuk menilai intervensi. Isian ini tidak mengubah C atau menetapkan infiltrasi secara otomatis.</p>
      {zone.surface === 'roof' && <p>Satu atap besar boleh tetap satu zona. Pisahkan zona hanya jika bagian atap mempunyai C atau jalur tangkapan yang berbeda dan luasnya dapat dinyatakan. Beberapa outlet tidak berarti seluruh air tersedia di setiap outlet; pembagian debit belum dimodelkan.</p>}
      <form id={formId} onSubmit={e => { e.preventDefault(); try {
        const f = new FormData(e.currentTarget), next = structuredClone(context);
        next.source = formText(f, 'contextSource');
        if (zone.surface === 'roof') next.roof = { ...next.roof, form: formText(f, 'roofForm') as typeof next.roof.form, material: formText(f, 'roofMaterial'), outlet: formText(f, 'roofOutlet') as typeof next.roof.outlet, pitch: numberFromForm(f, 'roofPitch', 'degrees') };
        if (zone.surface === 'paved') next.paved = { material: formText(f, 'pavedMaterial'), condition: formText(f, 'pavedCondition'), cracks: formText(f, 'pavedCracks') };
        if (zone.surface === 'soil' || zone.surface === 'vegetation') next.soil = { description: formText(f, 'soilTexture') as typeof next.soil.description, compaction: formText(f, 'compaction') as typeof next.soil.compaction, infiltration: numberFromForm(f, 'soilInfiltration', 'mm/h') };
        if (zone.surface === 'vegetation') next.vegetation = formText(f, 'vegetation') as typeof next.vegetation;
        if (zone.surface === 'porous') next.porous = { system: formText(f, 'system'), surfaceLayer: formText(f, 'surfaceLayer'), base: formText(f, 'base'), subgrade: formText(f, 'subgrade'), installationDate: formText(f, 'installationDate'), maintenance: formText(f, 'maintenance'), clogging: formText(f, 'clogging') as typeof next.porous.clogging };
        const typed = surfaceContextSchema.parse(next);
        const d = formText(f, 'destination');
        if ((!d && invalidRecipient) || (d.startsWith('intervention:') && !recipients.some(c => c.id === d.slice(13)))) { setError('Tujuan air sebelumnya tidak aktif. Pilih tujuan baru atau Belum diketahui.'); return; }
        const destination = destinationSchema.parse(d.startsWith('zone:') ? { kind: 'zone', id: d.slice(5) } : d.startsWith('intervention:') ? { kind: 'intervention', id: d.slice(13) } : d === 'drainage' || d === 'outside' ? { kind: d, note: formText(f, 'routeSource') } : { kind: 'unknown' });
        const routeChanged=zone.surface==='roof'&&(roofRoutingMeaning(context.roof)!==roofRoutingMeaning(typed.roof)||JSON.stringify(route?.destination??{kind:'unknown'})!==JSON.stringify(destination));
        if(routeChanged&&typed.roof.routing)typed.roof.routing.status='unchecked';
        const p = updateScience(routeChanged?invalidateRoofRouting(project,zoneId):project, s => { s.surfaces[zoneId] = typed; s.connections = s.connections.filter(c => c.sourceZoneId !== zoneId || c.candidateId); s.connections.push({ id: `existing-${zoneId}`, sourceZoneId: zoneId, destination, via: routeChanged?'unknown':route?.via??'unknown', origin: destination.kind === 'unknown' ? 'unknown' : 'user_supplied', source: formText(f, 'routeSource') }); });
        const issues = routingIssues(p); if (issues.length) throw new Error(issues.join(' '));
        onProject(p); setOpen(false);
      } catch { setError(zone.surface === 'roof' ? 'Kemiringan harus 0 hingga kurang dari 90°. Angka yang diketahui memerlukan sumber; pengukuran memerlukan metode dan tanggal. Periksa juga tujuan air agar tidak membentuk siklus.' : 'Periksa angka, sumber, metode/tanggal pengukuran dan tujuan air. Jalur tidak boleh membentuk siklus.'); } }}>
        {zone.surface === 'roof' && <><ChoiceField name="roofForm" label="Bentuk atap" value={context.roof.form} choices={{ unknown: 'Belum diketahui', flat: 'Datar', sloped: 'Miring', 'single-slope':'Satu arah', gable:'Pelana / dua arah', mixed: 'Campuran' }} /><TextField name="roofMaterial" label="Material atap" value={context.roof.material} /><ScientificNumberFields name="roofPitch" label="Kemiringan atap" initial={context.roof.pitch ?? unknownNumber('degrees')} /><small>Jika diketahui — sudut terhadap bidang horizontal, bukan persen. Untuk atap campuran, pisahkan zona jika sudutnya berbeda. Luas penangkap hujan tetap proyeksi horizontal; sudut tidak otomatis mengubah C atau volume.</small><ChoiceField name="roofOutlet" label="Pengeluaran air" value={context.roof.outlet} choices={{ unknown: 'Belum diketahui', 'gutter-downpipe': 'Talang / pipa turun', edge: 'Tepi atap', drain: 'Saluran', mixed: 'Campuran' }} /><ScientificReference claimId="CLAIM-ROOF" /></>}
        {zone.surface === 'paved' && <><TextField name="pavedMaterial" label="Material" value={context.paved.material} /><TextField name="pavedCondition" label="Kondisi permukaan" value={context.paved.condition} /><TextField name="pavedCracks" label="Retakan / celah" value={context.paved.cracks} /></>}
        {(zone.surface === 'soil' || zone.surface === 'vegetation') && <><ChoiceField name="soilTexture" label="Jenis tanah yang diketahui" value={context.soil.description} choices={{ unknown: 'Belum diketahui', sandy: 'Berpasir', loamy: 'Lempung campuran', clayey: 'Liat', mixed: 'Campuran' }} /><ChoiceField name="compaction" label="Kepadatan tanah" value={context.soil.compaction} choices={{ unknown: 'Belum diketahui', loose: 'Gembur', moderate: 'Sedang', compacted: 'Padat' }} /><ScientificNumberFields name="soilInfiltration" label="Bukti laju infiltrasi" initial={context.soil.infiltration} /><ScientificReference claimId="CLAIM-SOIL" /></>}
        {zone.surface === 'vegetation' && <><ChoiceField name="vegetation" label="Tutupan vegetasi" value={context.vegetation} choices={{ unknown: 'Belum diketahui', grass: 'Rumput', shrub: 'Semak', tree: 'Pohon', mixed: 'Campuran' }} /><ScientificReference claimId="CLAIM-VEGETATION" /></>}
        {zone.surface === 'porous' && <><p>Permukaan ini sudah diperhitungkan pada limpasan awal, bukan sebagai intervensi baru.</p>{(['system', 'surfaceLayer', 'base', 'subgrade', 'maintenance'] as const).map((key, i) => <TextField key={key} name={key} label={['Sistem berpori', 'Lapisan permukaan', 'Lapisan dasar', 'Tanah dasar', 'Pemeliharaan'][i]!} value={context.porous[key]} />)}<label>Tanggal pemasangan<input name="installationDate" type="date" defaultValue={context.porous.installationDate} /></label><ChoiceField name="clogging" label="Penyumbatan" value={context.porous.clogging} choices={{ unknown: 'Belum diperiksa', observed: 'Teramati', 'not-observed': 'Tidak teramati' }} /><ScientificReference claimId="CLAIM-POROUS" /></>}
        <TextField name="contextSource" label="Dasar kondisi permukaan" value={context.source} />
        <label>Tujuan air saat ini (deklarasi, bukan arah simulasi)<select name="destination" defaultValue={destinationValue} aria-invalid={invalidRecipient || undefined}>{invalidRecipient && <option value={destinationValue} disabled>{previousRecipient} — nonaktif; pilih ulang</option>}{Object.entries(destinationChoices).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {invalidRecipient && <p className="field-warning" role="status">Tujuan sebelumnya tidak aktif. Data lama tetap tersimpan; pilih tujuan baru atau Belum diketahui.</p>}
        <TextField name="routeSource" label="Dasar tujuan air" value={route?.source} />
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </ContextDialog>}
  </>;
}
export function RainScience({ project, scenarioId, onProject }: { project: ProjectV2; scenarioId: string; onProject: (p: ProjectV2) => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  const duration = project.science?.rainfall[scenarioId] ?? unknownNumber('minutes');
  const scenario = project.scenarios.find(s => s.id === scenarioId)!;
  const rainRef = scenario.overrides.find(o => o.baseParameterId === scenario.rainfall.id)?.replacement ?? scenario.rainfall;
  const average = rainfallAverageIntensity(project.parameters.find(p => p.id === rainRef.id)?.value ?? null, duration);
  return <><button className="text-button" onClick={() => setOpen(true)}>Durasi & konteks hujan</button>{average && <small className="option-draft-note">Intensitas rata-rata kejadian: {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(average.value)} mm/jam · bukan intensitas puncak</small>}
    {open && <ContextDialog title={`Durasi ${scenario.name}`} onClose={() => setOpen(false)} footer={<button type="submit" className="primary" form="rain-science">Simpan durasi</button>}>
      <form id="rain-science" onSubmit={e => { e.preventDefault(); try { const d = numberFromForm(new FormData(e.currentTarget), 'duration', 'minutes'); onProject(updateScience(project, s => { s.rainfall[scenarioId] = d; })); setOpen(false); } catch { setError('Durasi diketahui harus lebih dari nol dan memiliki dasar. Pengukuran memerlukan metode dan tanggal.'); } }}>
        <p>Durasi dapat ditambahkan bila diketahui. Kedalaman dibagi durasi menghasilkan intensitas rata-rata kejadian, bukan debit puncak, L/s atau pola aliran.</p><ScientificNumberFields name="duration" label="Durasi hujan" initial={duration} />
        <ScientificReference claimId="CLAIM-DURATION" />{error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </ContextDialog>}
  </>;
}
