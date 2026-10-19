import { useState } from 'react';
import type { ProjectV2 } from '../domain/projectV2';
import { allocationSequence, type Plan } from '../domain/planningEngine';
import type { Destination, Connection } from '../domain/scientificContract';
import { assessIntervention, feasibilityLabels } from '../domain/feasibility';
import { routeForSource } from '../domain/sourceRouting';
import { ContextDialog } from './ContextDialog';
import { ScientificReference } from './ScientificReference';

const pathLabels: Record<Connection['via'], string> = {
  unknown: 'jalur belum diketahui', 'gutter-downpipe': 'talang / pipa turun',
  edge: 'tepi permukaan', drain: 'saluran', other: 'jalur yang dinyatakan',
};
const referenceLabels: Record<string, string> = {
  'CLAIM-STORAGE': 'Sumber: tampungan', 'CLAIM-BIO-MEDIA': 'Sumber: media & tanaman',
  'CLAIM-POROUS': 'Sumber: konversi berpori', 'CLAIM-GROUNDWATER': 'Sumber: kondisi tanah',
  'CLAIM-LOCAL': 'Sumber: batas penerapan', 'CLAIM-CONNECTION': 'Sumber: sambungan',
  'CLAIM-MAINTENANCE': 'Sumber: pemeliharaan', 'CLAIM-FIELD': 'Sumber: pengamatan',
};
const originLabels = {
  unknown: 'belum diketahui', measured: 'kinerja terukur', 'design-declared': 'deklarasi desain',
  'literature-guided': 'panduan literatur', 'user-entered': 'asumsi pengguna',
};
function destinationLabel(project: ProjectV2, plan: Plan, destination: Destination): string {
  if ('id' in destination) return project.zones.find(z => z.id === destination.id)?.name
    ?? plan.components.find(c => c.id === destination.id)?.name ?? destination.id;
  return { unknown: 'tujuan belum diketahui', drainage: 'saluran', outside: 'keluar persil' }[destination.kind];
}
export function PlanScreening({ project, plan, scenarioId }: { project: ProjectV2; plan: Plan; scenarioId: string }) {
  const [open, setOpen] = useState(false);
  const items = plan.components.filter(c => c.enabled).map(c => ({
    c, f: assessIntervention(project, c, scenarioId, plan.parameters, plan.scientificEvidence?.[c.id]),
  }));
  if (!items.length) return <small className="quiet">Tanpa intervensi · kondisi awal</small>;
  const needsData = items.some(x => x.f.status === 'MORE_DATA_REQUIRED' || x.f.status === 'INFEASIBLE_WITH_AVAILABLE_DATA');
  const conditional = items.some(x => x.f.status === 'FEASIBLE_WITH_CONDITIONS');
  return <>
    <button className="text-button" onClick={() => setOpen(true)}>{needsData ? 'Kelayakan perlu ditinjau' : conditional ? 'Layak dengan syarat · periksa' : 'Kelayakan pra-perencanaan · periksa'}</button>
    {open && <ContextDialog title={`Kelayakan ${plan.name}`} onClose={() => setOpen(false)}>
      <details className="calculation-source-technical"><summary>Urutan neraca & sumber air</summary>
        <p>Konversi berpori lokal lebih dahulu; lainnya mengikuti urutan rencana. Setiap opsi memakai air tersisa dari zona berikut, dibaca berurutan.</p>
        <ol>{allocationSequence(plan).map(c => <li key={c.id}><strong>{c.name}</strong> · {c.targets.map(id => project.zones.find(z => z.id === id)?.name ?? id).join(' → ')}</li>)}</ol>
        <p>Urutan dapat mengubah pembagian air. Ini aturan pembukuan konservatif, bukan hasil simulasi hidraulik atau pembagian debit nyata.</p>
      </details>
      {items.map(({ c, f }) => {
        const findings = [...f.reasons, ...f.missing, ...f.conditions];
        const basis = plan.scientificEvidence?.[c.id]?.performance[scenarioId]
          ?? project.science?.interventions[c.id]?.performance[scenarioId];
        const coreClaim = c.family === 'storage' ? 'CLAIM-STORAGE' : c.family === 'rain-garden'
          ? 'CLAIM-BIO-MEDIA' : c.family === 'permeable' ? 'CLAIM-POROUS' : 'CLAIM-GROUNDWATER';
        return <section key={c.id}>
          <h3>{c.name}</h3><strong>{feasibilityLabels[f.status]}</strong>
          <h4>Sumber yang dinyatakan</h4>
          <ul>{c.targets.map(zoneId => {
            const route = routeForSource(project, zoneId, c.id);
            const path = c.family === 'permeable' ? 'konversi pada zona ini' : route.length
              ? route.map(link => `${pathLabels[link.via]} → ${destinationLabel(project, plan, link.destination)}`).join(' → ')
              : 'sambungan belum dinyatakan';
            return <li key={zoneId}>{project.zones.find(z => z.id === zoneId)?.name ?? zoneId} → {path}</li>;
          })}</ul>
          <p className="quiet">Sambungan yang dicatat pengguna, bukan hasil simulasi aliran.</p>
          <p>Dasar kinerja: {basis ? `${originLabels[basis.origin]} · ${basis.source || 'dasar belum diketahui'}` : 'belum ditinjau untuk hujan ini'}</p>
          <ul>{findings.map(x => <li key={`${x.ruleId}:${x.message}`}>{x.message.replace(/\bUNKNOWN\b/g,'belum diketahui')}</li>)}</ul>
          <h4>Sebelum desain lanjutan</h4><ul>{f.fieldChecks.map(x => <li key={x}>{x.replace(/\bUNKNOWN\b/g,'belum diketahui')}</li>)}</ul>
          <div className="scientific-claim-links">{[...new Set([coreClaim, ...findings.map(x => x.claimId)])].map(claimId => <ScientificReference key={claimId} claimId={claimId} label={referenceLabels[claimId] ?? 'Dasar ilmiah'} />)}</div>
        </section>;
      })}
      <p className="quiet">Hasil memakai data dan asumsi yang dinyatakan. Bukan sertifikasi keselamatan atau jaminan kinerja lapangan.</p>
    </ContextDialog>}
  </>;
}
