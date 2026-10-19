import { useState } from 'react';
import { methodNotes } from '../domain/methodTraceability';
import { ScientificReference } from './ScientificReference';
const sourceLabels: Record<string,string> = {
  'CLAIM-VOLUME':'volume hujan–limpasan', 'CLAIM-VOLUME-LIMIT':'batas model volume',
  'CLAIM-SOIL':'tanah', 'CLAIM-VEGETATION':'vegetasi', 'CLAIM-POROUS':'perkerasan berpori',
  'CLAIM-DURATION':'durasi hujan', 'CLAIM-CONNECTION':'sambungan', 'CLAIM-STORAGE':'tangki',
  'CLAIM-GROUNDWATER':'air tanah & persyaratan', 'CLAIM-BIO-MEDIA':'media & tanaman',
  'CLAIM-MAINTENANCE':'pemeliharaan', 'CLAIM-LOCAL':'penerapan di lokasi',
  'CLAIM-PARETO':'Pareto', 'CLAIM-FIELD':'pengamatan lapangan',
  'CLAIM-BIOPORI':'biopori',
};

export function MethodGuide({ initial = 'rainfall' }: { initial?: string }) {
  const [id, setId] = useState(initial);
  const item = methodNotes.find(m => m.id === id) ?? methodNotes[0]!;
  return <section className="method-guide" aria-label="Jejak metode TIRTA">
    <label>Langkah yang ingin dipahami<select value={item.id} onChange={e => setId(e.target.value)}>
      {[...new Set(methodNotes.map(m => m.stage))].map(stage => <optgroup key={stage} label={stage}>{methodNotes.filter(m => m.stage === stage).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</optgroup>)}
    </select></label>
    <h2>{item.title}</h2><p className="basics-lead">{item.summary}</p>
    <h3>Data yang dibutuhkan</h3><p>{item.inputs}</p>
    <h3>Cara TIRTA memakainya</h3><p>{item.method}</p>
    <h3>Apa artinya bagi rencana saya?</h3><p>{item.interpretation}</p>
    <details className="calculation-source-technical"><summary>Batas penerapan & sumber</summary>
      <p>{item.limit}</p>
      {item.claimIds.length ? <div className="scientific-claim-links">{item.claimIds.map(claimId => <ScientificReference key={claimId} claimId={claimId} label={`Bukti: ${sourceLabels[claimId] ?? claimId}`} />)}</div> : <p>Dasar: cakupan proposal TIRTA dan geometri berdimensi. Bukan formula empiris yang memerlukan koefisien jurnal.</p>}
    </details>
  </section>;
}
