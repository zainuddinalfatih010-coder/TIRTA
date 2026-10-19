import { useState } from 'react';
import { ContextDialog } from './ContextDialog';
import { evidenceForClaim, scientificClaims, authoritativeReferences } from '../domain/evidenceRegistry';
import { journalEvidence } from '../domain/evidenceCatalog';
export function ScientificReference({ claimId, label = 'Dasar ilmiah' }: { claimId?: string; label?: string }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const claim = scientificClaims.find(c => c.id === claimId);
  const records = claimId ? evidenceForClaim(claimId) : [...journalEvidence, ...authoritativeReferences];
  const filtered = records.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  return <><button type="button" className="text-button" onClick={() => setOpen(true)}>{label}</button>
    {open && <ContextDialog title={claim ? 'Mengapa data ini diperlukan?' : 'Dasar ilmiah TIRTA'} onClose={() => setOpen(false)}>
      {claim && <><p><strong>{claim.wording}</strong></p><p>{claim.scope}</p><p className="quiet">{claim.limitations}</p></>}
      {!claim && <><p>20 jurnal inti, 5 cadangan; studi biopori, standar dan laporan dicatat terpisah. Referensi tidak menetapkan kapasitas atau koefisien persil Anda secara otomatis.</p><label>Cari referensi<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Judul, penulis, topik" /></label></>}
      {!filtered.length && <p role="status">Tidak ada referensi yang cocok. Coba judul, penulis atau topik lain.</p>}
      <ul className="scientific-references">{filtered.map(r => <li key={r.id}>
        <details className="evidence-record"><summary><strong>{r.title}</strong><small>{'authors' in r ? `${r.year} · ${r.journal}` : 'Panduan / metode'}</small></summary>
          {'authors' in r && <><small>{r.id} · {r.authors.join(', ')} · {r.year} · {r.journal}</small><p>{r.localRelevance}</p><p><strong>Konteks studi:</strong> {r.studyType} · {r.geography} · {r.climate}</p><small>{r.limitations}</small><small>Peninjauan: {r.verification === 'publisher-abstract' ? 'abstrak penerbit dan cakupan' : 'metadata dan cakupan bibliografis'}; bukan seluruh teks atau validasi persil ini. Ditinjau {r.reviewedOn}.</small></>}
          {'limitation' in r && <small>{r.limitation}</small>}
          <a href={r.url} target="_blank" rel="noreferrer">Buka sumber · {r.title}</a>
        </details>
      </li>)}</ul>
    </ContextDialog>}
  </>;
}
