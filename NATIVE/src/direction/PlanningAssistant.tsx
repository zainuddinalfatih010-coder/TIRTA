import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Droplets, Leaf, MapPin, Send, Undo2, Waves, X } from 'lucide-react';
import { answerLocally, applyProposal, packageCandidates, proposalFor, type LocalAnswer, type Proposal } from '../assistant/assistance';
import { sourcesFor } from '../assistant/knowledge';
import { objectsForQuestion, topicForQuestion, type AssistantStep, type AssistantTopic } from '../assistant/context';
import { planningFingerprint, type Alternative } from '../domain/planningEngine';
import { siteGuidance, type SiteGuidance } from '../domain/siteGuidance';
import { productionBaseline } from '../domain/productionBaseline';
import type { ProjectV2 } from '../domain/projectV2';
import { ContextDialog } from './ContextDialog';
import { HelpButton } from './TirtaHelp';
import { Parcel } from './Parcel';
import { guidedCandidates, type RecommendationPriority } from '../assistant/recommendationGuide';
import { AssistantContext } from './AssistantContext';
import { fmt, money, type OptionId } from './productionBridge';
import './planning-assistant.css';

type Message = { id: string; question: string; answer: LocalAnswer; fingerprint: string; scenarioId: string };
type Props = { startRecommendation?: boolean; project: ProjectV2; scenario: string; alternatives: readonly Alternative[]; originStep: AssistantStep; selectedZoneId: string; selectedInterventionId: string | null; onProject: (project: ProjectV2) => void; onNavigate: (destination: AssistantStep) => void };
const priorityLabels = { residual: 'Sisa limpasan terendah', cost: 'Biaya terendah', area: 'Lahan paling sedikit' };
const statusLabels = { eligible: 'Dapat ditinjau', 'needs-data': 'Perlu data', conflict: 'Ada kendala', retired: 'Nonaktif pada pilot' };

/** Local rule guidance and reviewed knowledge; no model or transport dependency. */
export function PlanningAssistant({ startRecommendation = false, project, scenario, alternatives, originStep, selectedZoneId, selectedInterventionId, onProject, onNavigate }: Props) {
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<RecommendationPriority | ''>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [problem, setProblem] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [inspectedGuidanceZone, setInspectedGuidanceZone] = useState<string | null>(null);
  const [preview, setPreview] = useState<Proposal | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [undo, setUndo] = useState<{ fingerprint: string; planId: string; scenarioId: string; previous: ProjectV2['selectedPlan'] } | null>(null);
  const [applied, setApplied] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'conversation' | 'project'>('conversation');
  const [discussion, setDiscussion] = useState<AssistantTopic | null>(startRecommendation ? 'alternatives' : null);
  const [discussionText, setDiscussionText] = useState('');
  const composer = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const layout=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const resize=()=>{const el=layout.current;if(el){const top=el.getBoundingClientRect().top+window.scrollY;el.style.setProperty('--assistant-room',`${Math.max(160,(window.visualViewport?.height??window.innerHeight)-top-16)}px`);}};
    resize();const observer=new ResizeObserver(resize);const rail=document.querySelector('.app-rail');if(rail)observer.observe(rail);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
    return()=>{observer.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
  },[]);
  const fingerprint = planningFingerprint(project);
  const baseline = useMemo(() => productionBaseline(project, scenario), [project, scenario]);
  const candidates = useMemo(() => packageCandidates(project, alternatives, scenario), [project, alternatives, scenario]);
  const highlighted = priority ? guidedCandidates(project, candidates, scenario, priority).map(c => c.plan.id) : [];
  const active = candidates.find(c => c.plan.id === candidateId);
  const staleUndo = !!undo && (undo.fingerprint !== fingerprint || undo.scenarioId !== scenario || project.selectedPlan?.definition.id !== undo.planId);
  const discussionObjects = objectsForQuestion(discussionText, project);
  const componentId = discussionObjects.interventionId ?? (originStep === 'interventions' ? selectedInterventionId ?? undefined : undefined);
  const sourceChoice=project.zones.some(z=>z.id===sourceId)?sourceId:'';
  const installationChoice=project.zones.some(z=>z.id===installationId)?installationId:'';
  const guidance = useMemo(() => siteGuidance(project, scenario, {
    sourceZoneIds: sourceChoice ? [sourceChoice] : undefined,
    installationZoneId: installationChoice || undefined,
    componentId,
  }), [project, scenario, sourceChoice, installationChoice, componentId]);

  useEffect(() => { composer.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (messages.length) conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'instant' }); }, [messages.length]);
  useEffect(() => { if (composer.current) { composer.current.style.height = 'auto'; composer.current.style.height = `${Math.min(composer.current.scrollHeight, 124)}px`; } }, [question]);

  const submit = (text = question) => {
    if (!text.trim()) return;
    setProblem('');
    const objects = objectsForQuestion(text, project);
    const local = answerLocally(text, project, scenario, alternatives);
    const topic = topicForQuestion(text) ?? (objects.interventionId ? 'interventions' : objects.zoneId ? 'studio' : null);
    if (topic) { setDiscussion(topic); setDiscussionText(text); }
    // Inspecting or mentioning a zone is context, not a source declaration.
    const answer: LocalAnswer = local?.recommend ? {
      title: 'Pilih prioritas yang ingin dibandingkan',
      text: 'TIRTA membandingkan paket yang Anda nyatakan. Pilih sisa limpasan, biaya, atau lahan sebagai prioritas. Paket dengan nilai setara tetap ditampilkan; tidak ada satu pemenang tersembunyi.',
      claimIds: ['CLAIM-VOLUME'], recommend: true,
    } : local ?? {
      title: 'Pertanyaan ini belum ada dalam panduan lokal',
      text: 'Panduan ini memakai aturan lokasi dan penjelasan yang sudah ditinjau. Pilih topik dasar atau buka isian terkait; pertanyaan terbuka tidak diubah menjadi jawaban ilmiah yang belum didukung.',
      claimIds: [],
    };
    setMessages(previous => [...previous.slice(-39), { id: crypto.randomUUID(), question: text, answer, fingerprint, scenarioId: scenario }]);
    setMobilePanel('conversation');
    setQuestion('');
  };
  const review = () => {
    if (!active || !priority) return;
    setPreview(proposalFor(project, scenario, active.plan, priority));
    setAcknowledged(false);
    setProblem('');
  };
  const apply = () => {
    if (!preview || !acknowledged) return;
    try {
      const next = applyProposal(project, scenario, preview);
      onProject(next);
      setUndo({ fingerprint: planningFingerprint(next), previous: project.selectedPlan, planId: preview.plan.id, scenarioId: scenario });
      setApplied('Paket dipilih sebagai rencana.');
      setPreview(null);
    } catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Paket belum dapat diterapkan.'); }
  };
  const nextAction = (item: SiteGuidance) => {
    onNavigate(item.nextAction.step === 'parcel' ? 'studio' : item.nextAction.step);
    window.dispatchEvent(new CustomEvent('tirta-guidance-action', { detail: { field: item.nextAction.field, method: item.id, sourceId, installationZoneId: installationId, componentId } }));
  };

  const packageContent = <div className="assistant-package">
    <header><h2>Bandingkan sesuai prioritas</h2></header>
    <div className="assistant-package-picker assistant-priority-picker"><label htmlFor="assistant-priority">Prioritas rekomendasi</label><select id="assistant-priority" value={priority} onChange={e => { setPriority(e.target.value as RecommendationPriority | ''); setCandidateId(''); }}><option value="">Pilih prioritas Anda</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {priority && <p className="assistant-context-note">{highlighted.length ? `${highlighted.length} paket memenuhi prioritas ini${highlighted.length > 1 ? ' dengan nilai setara' : ''}.` : 'Belum ada paket yang dapat dibandingkan.'} Seluruh pertukaran biaya, lahan, dan limpasan tetap dapat ditinjau.</p>}
    {candidates.length ? <>
      <div className="assistant-package-picker"><label htmlFor="assistant-package">Paket dalam batas · {candidates.length}</label><select id="assistant-package" value={active?.plan.id ?? ''} onChange={e => setCandidateId(e.target.value)}><option value="">Pilih paket untuk ditinjau</option>{candidates.map(c => <option key={c.plan.id} value={c.plan.id}>{highlighted.includes(c.plan.id) ? 'Sesuai prioritas · ' : ''}{c.plan.name} · {c.plan.components.filter(x => x.enabled).map(x => x.name).join(' + ')}</option>)}</select></div>
      {priority && <div className="assistant-priority-options" aria-label="Paket setara sesuai prioritas">{candidates.filter(c => highlighted.includes(c.plan.id)).map(c => <button key={c.plan.id} aria-pressed={active?.plan.id === c.plan.id} onClick={() => setCandidateId(c.plan.id)}>{c.plan.name}<small>{fmt(c.balance.residual)} m³ · {money(c.balance.cost)} · {fmt(c.balance.area)} m²</small></button>)}</div>}
      {active && <>
        <div className="assistant-parcel"><Parcel project={project} selected="" compact fit materialTextures enabled={active.plan.components.filter(c => c.enabled).map(c => c.id as OptionId)}/></div>
        <p className="assistant-composition">{active.plan.components.filter(c => c.enabled).map(c => c.name).join(' + ')}</p>
        <dl className="assistant-metrics"><div><dt>Sisa limpasan</dt><dd>{fmt(active.balance.residual)} <small>m³</small></dd></div><div><dt>Biaya</dt><dd>{money(active.balance.cost)}</dd></div><div><dt>Lahan</dt><dd>{fmt(active.balance.area)} <small>m²</small></dd></div></dl>
        <div className="assistant-reason"><strong>{priority ? `Prioritas: ${priorityLabels[priority].toLocaleLowerCase('id-ID')}` : 'Prioritas belum dipilih'}</strong><p>{highlighted.includes(active.plan.id) ? 'Paket ini memenuhi prioritas eksplisit pada hujan aktif dalam batas yang dinyatakan.' : 'Tinjau pertukaran biaya, lahan, dan sisa limpasan paket ini.'}{highlighted.length > 1 ? ' Paket lain memiliki nilai prioritas yang setara.' : ''}</p></div>
        <p className="assistant-conditions">{active.assessment.checks.length ? `${active.assessment.checks.length} kondisi penerapan masih perlu ditinjau.` : 'Periksa penyaluran dan kondisi lapangan sebelum pemasangan.'}</p>
        <div className="assistant-package-actions"><button className="primary" disabled={!priority} onClick={review}>Tinjau & terapkan<ArrowRight size={17}/></button><button onClick={() => onNavigate('compare')}>Bandingkan</button></div>
      </>}
    </> : <div className="assistant-package-empty"><Waves size={34}/><h3>Belum ada paket</h3><p>Lengkapi kapasitas, hubungan sumber, biaya, lahan, dan batas yang diperlukan. Angka yang belum diketahui tetap kosong.</p><button onClick={() => onNavigate('interventions')}>Lengkapi intervensi<ArrowRight size={17}/></button></div>}
    <HelpButton topic="interventions" label="Dasar paket & neraca air"/>
    {applied && <div className="assistant-applied" role="status"><Check size={17}/><p>{applied}</p>{undo && !staleUndo && <button onClick={() => { onProject({ ...project, selectedPlan: undo.previous }); setUndo(null); setApplied('Pemilihan paket dibatalkan.'); }}><Undo2 size={16}/>Batalkan pilihan</button>}{staleUndo && <p>Data berubah; pembatalan pilihan lama tidak tersedia.</p>}</div>}
  </div>;

  return <section className="planning-assistant" data-testid="planning-assistant" aria-label="Panduan TIRTA">
    <h1 className="sr-only">Panduan lokasi TIRTA</h1>
    {problem && <p className="assistant-problem" role="alert">{problem}</p>}
    <div className="assistant-mobile-tabs" aria-label="Tampilan bantuan"><button aria-pressed={mobilePanel === 'conversation'} onClick={() => setMobilePanel('conversation')}>Panduan lokasi</button><button aria-pressed={mobilePanel === 'project'} onClick={() => setMobilePanel('project')}>Konteks</button></div>
    <div ref={layout} className="assistant-layout" data-mobile-panel={mobilePanel}>
      <div className="assistant-conversation">
        <div className="assistant-messages" ref={conversation}>
          <section className="assistant-site-guide" aria-label="Panduan kondisi lokasi">
            <header><span className="assistant-eyebrow">PANDUAN LOKASI</span><h2>Apa yang dapat direncanakan?</h2><p>Kondisi lokasi menentukan data berikutnya. Setiap opsi menyatakan alasan dan batasnya; belum berarti siap dibangun.</p></header>
            <div className="assistant-site-selectors"><label htmlFor="guidance-source">Sumber air<select id="guidance-source" value={sourceChoice} onChange={e => { setSourceId(e.target.value); setInspectedGuidanceZone(e.target.value); setDiscussion('studio'); setDiscussionText(''); }}><option value="">Belum dipilih</option>{project.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label htmlFor="guidance-installation">Lokasi pemasangan<select id="guidance-installation" value={installationChoice} onChange={e => { setInstallationId(e.target.value); setInspectedGuidanceZone(e.target.value); setDiscussion('studio'); setDiscussionText(''); }}><option value="">Belum dipilih</option>{project.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label></div>
            <div className="assistant-site-options">{guidance.map(item => <article key={item.id} className="assistant-site-option" data-status={item.status} data-guidance={item.id}>
              <div className="assistant-site-symbol" aria-hidden="true">{item.id === 'storage' ? <Droplets size={30}/> : item.id === 'rain-garden' ? <Leaf size={30}/> : item.id === 'permeable' ? <Waves size={30}/> : <MapPin size={30}/>}</div>
              <div><header><h3>{item.name}</h3><span className="assistant-site-status">{statusLabels[item.status]}</span></header><p>{item.reason}</p>{item.eventReady && <small>Dapat dihitung pada hujan yang dipilih</small>}{item.conditions.length > 0 && <details><summary>Kondisi yang perlu ditinjau · {item.conditions.length}</summary><ul>{item.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul></details>}<button className="text-button" onClick={() => nextAction(item)}>{item.nextAction.label}<ArrowRight size={16}/></button></div>
            </article>)}</div>
            <button className="assistant-open-comparison" onClick={() => { setDiscussion('alternatives'); setMobilePanel('project'); }}>Pilih prioritas & bandingkan paket<ArrowRight size={17}/></button>
            <p className="assistant-local-note"><BookOpen size={15}/>Aturan dan penjelasan di perangkat · tanpa layanan generatif</p>
          </section>
          <div className="assistant-starters">{['Data apa yang masih kurang?', 'Dari mana angka limpasan?', 'Bagaimana memilih paket sesuai prioritas saya?'].map(q => <button key={q} onClick={() => submit(q)}>{q}<ArrowRight size={16}/></button>)}</div>
          <div role="log" aria-label="Jawaban panduan TIRTA" aria-live="polite">{messages.map(message => {
            const sources = sourcesFor(message.answer.claimIds);
            const outdated = message.fingerprint !== fingerprint || message.scenarioId !== scenario;
            return <article className="assistant-exchange" key={message.id}><p className="assistant-question">{message.question}</p><div className="assistant-answer"><div className="assistant-signature"><BookOpen size={20}/><span>TIRTA<small>Penjelasan lokal</small></span></div><h2>{message.answer.title}</h2><p>{message.answer.text}</p>{!outdated && topicForQuestion(message.question) === 'rain' && baseline.ok && <dl className="assistant-answer-facts"><div><dt>Luas area</dt><dd>{fmt(baseline.value.areaM2)} m²</dd></div><div><dt>Hujan aktif</dt><dd>{fmt(baseline.value.rainfallMm)} mm</dd></div><div><dt>Limpasan awal</dt><dd>{fmt(baseline.value.runoffM3)} m³</dd></div></dl>}{outdated && <p className="assistant-stale">Data atau hujan berubah. Jawaban ini merujuk kondisi sebelumnya.</p>}{message.answer.action && <button className="text-button" onClick={() => onNavigate(message.answer.action!.destination)}>{message.answer.action.label}<ArrowRight size={16}/></button>}{sources.length > 0 && <details className="assistant-sources"><summary><BookOpen size={16}/>Dasar & sumber<ChevronDown size={14}/></summary><ul>{sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{'limitations' in source ? source.limitations : source.limitation}</p>{'verification' in source && <small>{source.verification === 'publisher-abstract' ? 'Abstrak penerbit ditinjau; bukan seluruh teks jurnal.' : 'Identitas & cakupan ditinjau; bukan seluruh teks jurnal.'}</small>}</li>)}</ul></details>}</div></article>;
          })}</div>
        </div>
        <form className="assistant-composer" onSubmit={e => { e.preventDefault(); submit(); }}><label className="sr-only" htmlFor="assistant-question">Pertanyaan Anda</label><div className="assistant-input"><BookOpen size={20} aria-hidden="true"/><textarea ref={composer} id="assistant-question" value={question} maxLength={1600} rows={1} placeholder="Cari penjelasan TIRTA…" onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} aria-describedby="assistant-local-explanation"/><button aria-label="Kirim pertanyaan" type="submit" disabled={!question.trim()}><Send size={21}/></button></div><p className="sr-only" id="assistant-local-explanation">Panduan dijawab di perangkat dari penjelasan yang ditinjau. Tidak mengirim pertanyaan atau data ke model.</p></form>
      </div>
      <AssistantContext key={`${discussionText}:${inspectedGuidanceZone}:${selectedZoneId}:${selectedInterventionId}`} project={project} scenario={scenario} originStep={originStep} discussion={discussion} selectedZoneId={discussionObjects.zoneId ?? inspectedGuidanceZone ?? selectedZoneId} selectedInterventionId={discussionObjects.interventionId ?? selectedInterventionId} interventionFamily={discussionObjects.interventionFamily} packageContent={packageContent} onReset={() => { setDiscussion(null); setDiscussionText(''); setInspectedGuidanceZone(null); }} onTopic={setDiscussion} onNavigate={onNavigate}/>
    </div>
    {preview && <ContextDialog title="Tinjau sebelum menerapkan" onClose={() => setPreview(null)} footer={<><button onClick={() => setPreview(null)}><X size={16}/>Kembali</button><button className="primary" disabled={!acknowledged || preview.fingerprint !== fingerprint || preview.scenarioId !== scenario} onClick={apply}>Terapkan sebagai rencana pilihan<ArrowRight size={17}/></button></>}><p>Yang berubah: rencana pilihan menjadi <strong>{preview.plan.name}</strong>. Data persil, hujan, dan konfigurasi intervensi tidak ditimpa.</p><ul>{candidates.find(c => c.plan.id === preview.plan.id)?.assessment.checks.map(check => <li key={check}>{check}</li>)}</ul><p>Prioritas: {priorityLabels[preview.priority ?? 'residual'].toLocaleLowerCase('id-ID')} pada hujan aktif. Ini pra-perencanaan; bukan bukti bebas genangan atau desain konstruksi.</p><label className="assistant-acknowledge"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/>Saya sudah meninjau paket dan kondisi penerapannya.</label>{(preview.fingerprint !== fingerprint || preview.scenarioId !== scenario) && <p role="alert">Data atau hujan berubah. Tutup dan tinjau paket kembali.</p>}</ContextDialog>}
  </section>;
}
