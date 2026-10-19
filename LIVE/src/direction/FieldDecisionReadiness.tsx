import { ArrowRight } from 'lucide-react';
import type { FieldDecisionAction, FieldDecisionState } from '../domain/fieldDecisionReadiness';
import './field-decision-readiness.css';

type Props = {
  state: FieldDecisionState;
  scope?: 'active' | 'selected' | 'baseline';
  onAction: (action: FieldDecisionAction) => void;
};

/** One useful next question first; the full validator findings remain inspectable. */
export function FieldDecisionReadiness({ state, scope = 'selected', onAction }: Props) {
  const readiness = scope === 'selected' ? state.selected : state.activePackage;
  const actions = scope === 'baseline' ? state.baseline.actions : readiness.actions;
  const first = actions[0];
  const title = !state.baseline.ready ? 'Limpasan awal belum dapat dihitung'
    : scope === 'baseline' ? 'Limpasan awal dapat dihitung'
      : scope === 'selected' && state.selected.status === 'stale' ? 'Rencana perlu ditinjau kembali'
        : scope === 'selected' && state.selected.status === 'none' ? 'Belum ada rencana pilihan'
          : !readiness.calculationReady ? 'Dampak belum dapat dihitung'
            : !readiness.comparisonReady ? 'Dampak air dapat dihitung; biaya dan lahan belum memenuhi syarat'
              : scope === 'selected' ? 'Rencana pilihan menggunakan data terbaru' : 'Penanganan dapat dibandingkan';
  const mainActions = !state.baseline.ready ? state.baseline.actions : actions;
  const next = !state.baseline.ready ? state.baseline.actions[0] : first;
  return <section className="field-decision-readiness" aria-label="Kesiapan rencana" data-ready={scope === 'selected' ? state.selected.ready : scope === 'baseline' ? state.baseline.ready : readiness.comparisonReady}>
    <h2>{title}</h2>
    {scope !== 'baseline' && state.baseline.ready && !(scope === 'selected' && ['none', 'stale'].includes(state.selected.status)) && <p className="field-decision-states">
      <span>Perhitungan air: <strong>{readiness.calculationReady ? 'tersedia' : 'perlu data'}</strong></span>
      <span>Perbandingan biaya dan lahan: <strong>{readiness.comparisonReady ? 'tersedia' : 'perlu ditinjau'}</strong></span>
    </p>}
    {next && <div className="field-decision-next">
      <p>{next.message}</p>
      <p><strong>{next.question}</strong></p>
      <p className="field-decision-consequence">{next.consequence}</p>
      <button type="button" onClick={() => onAction(next)}>{next.label}<ArrowRight size={16} aria-hidden="true" /></button>
    </div>}
    {mainActions.length > 1 && <details>
      <summary>{mainActions.length - 1} hal lain perlu ditinjau</summary>
      <ul>{mainActions.slice(1).map((item, index) => <li key={`${item.componentId ?? ''}-${item.ruleId}-${item.scenarioId}-${index}`}>
        <p>{item.message}</p>
        <button type="button" onClick={() => onAction(item)}>{item.label}<ArrowRight size={15} aria-hidden="true" /></button>
      </li>)}</ul>
    </details>}
  </section>;
}
