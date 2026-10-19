import { useState, useRef, useEffect, useEffectEvent } from 'react';
import { ArrowRight, ArrowUp, MapPin, Search } from 'lucide-react';
import type { ProjectV2 } from '../domain/projectV2';
import type { ComponentVariant } from '../domain/intervention-contract';
import { componentEditorValues,fmt,money,setActiveComponents } from './productionBridge';
import { readInput, saveComponent, type SourcedInput } from '../domain/planningAuthoring';
import { sharedPlanningSpace, planningSpaceId } from '../domain/planningWorkspace';
import { emptyInterventionEvidence, destinationSchema, type Connection } from '../domain/scientificContract';
import { scientificScenarioContext, updateScience } from '../domain/scientificAuthoring';
import { fieldDecisionReadiness } from '../domain/fieldDecisionReadiness';
import { bioporiInstallationAllowed, referencedSoil, sharedSources } from '../domain/treatmentDesign';
import { PlanningNumberForm } from './PlanningNumberForm';
import { ContextDialog } from './ContextDialog';
import { InterventionArt } from './InterventionWorkspace';
import { InterventionScience } from './InterventionScience';
import { HelpButton } from './TirtaHelp';
import { planningError } from './planningError';
import { rupiahCanonical } from './planningNumbers';
import { evidenceSchema } from '../domain/model';
import { overflowChoices, invalidatedDestinationLabels } from '../domain/treatmentLifecycle';
import { numericInput } from '../domain/validation';
import { treatmentRequirements } from '../domain/productState';
import { GuidedTreatmentFields, taskQuestions, taskField } from './GuidedTreatmentFields';
import { intakeQuestions, questionQueue, sourceRunoffFact, type IntakeAnswers } from '../domain/guidedIntake';
import { numberFromForm, formText } from './ScientificInputs';
import { assessIntervention } from '../domain/feasibility';
import { evaluateEventPlan, snapshotPlan } from '../domain/planningEngine';
import { reviewLegacySite } from '../domain/interventionSuitability';
import './treatment-composer.css';
import './guided-treatment.css';

export type SelectionRole = 'source' | 'installation' | 'conversion';
const roleTitles = { source: 'Pilih sumber limpasan', installation: 'Pilih lokasi penerapan', conversion: 'Pilih permukaan yang akan diubah' };
export function ZoneRolePicker({ project, role, onPick, onCanvas, onClose, soilOnly = false }: { soilOnly?: boolean; project: ProjectV2; role: SelectionRole; onPick: (id: string) => void; onCanvas: () => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const zones = project.zones.filter(z => (role !== 'conversion' || z.surface === 'paved') && (role !== 'installation' || !soilOnly || bioporiInstallationAllowed(z.surface)) && z.name.toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID')));
  return <ContextDialog title={roleTitles[role]} onClose={onClose} className="zone-role-dialog">
    <label className="role-search"><Search size={18} aria-hidden="true"/>Cari zona<input autoFocus type="search" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }} value={query} onChange={e => setQuery(e.target.value)}/></label>
    {role === 'installation' && soilOnly && <p>Biopori dapat dipasang pada semua jenis permukaan kecuali Atap. Sumber air boleh berasal dari zona lain.</p>}
    <div className="role-zone-list">{zones.map(z => <button key={z.id} type="button" onClick={() => onPick(z.id)}><span>{z.name}</span><small>{readInput(project, z.area).text || '?'} m²</small><ArrowRight size={16}/></button>)}</div>
    {!zones.length && <p>Tidak ada zona yang cocok{role === 'conversion' ? '. Penggantian memerlukan zona Beton/Aspal' : ''}.</p>}
    <button type="button" className="text-button" onClick={onCanvas}><MapPin size={17}/>Pilih pada persil</button>
    {role === 'installation' && <button type="button" className="text-button" onClick={() => onPick('')}>Lokasi belum diketahui</button>}
  </ContextDialog>;
}
const inputFrom = (data: FormData, name: string, currency = false): SourcedInput => ({ text: currency ? rupiahCanonical(String(data.get(name) ?? '')) : String(data.get(name) ?? ''), source: String(data.get(`${name}Source`) ?? ''), evidence: evidenceSchema.parse(data.get(`${name}Evidence`) ?? 'UNKNOWN') });

function ResourceDraft({project,componentId,installationZoneId}:{project:ProjectV2;componentId:string;installationZoneId:string}) {
  const selected=project.components.find(c=>c.id===componentId)!;
  const values={cost:readInput(project,selected.totalCost).text,area:readInput(project,selected.occupiedArea).text};
  const parse=(raw:string)=>{const r=numericInput(raw);return r.ok?r.value:null;};
  const receiving=project.zones.find(z=>z.id===installationZoneId);
  const receivingArea=project.parameters.find(p=>p.id===receiving?.area.id)?.value;
  const otherFootprints=project.components.filter(c=>c.enabled && c.id!==componentId && c.treatment?.installationZoneId===installationZoneId).map(c=>project.parameters.find(p=>p.id===c.occupiedArea.id)?.value??null);
  const footprint=parse(values.area??'');
  const component=project.components.find(c=>c.id===componentId)!;
  const savedCost=project.parameters.find(p=>p.id===component.totalCost.id)?.value??null;
  const savedArea=project.parameters.find(p=>p.id===component.occupiedArea.id)?.value??null;
  const dirty=!numericInput(rupiahCanonical(values.cost??'')).ok||!numericInput(values.area??'').ok||parse(rupiahCanonical(values.cost??''))!==savedCost||footprint!==savedArea;
  return <section className="resource-draft" aria-label="Pratinjau biaya dan ruang"><strong>Pratinjau isian</strong>{[
    {label:'Biaya',value:parse(rupiahCanonical(values.cost??'')),limit:project.parameters.find(p=>p.id===project.constraints.budget.id)?.value??null,format:money},
    {label:'Ruang',value:footprint,limit:project.parameters.find(p=>p.id===project.constraints.usableArea.id)?.value??null,format:(n:number)=>`${fmt(n)} m²`},
  ].map(row=>{const share=row.value!==null&&row.limit!==null&&row.limit>0?row.value/row.limit*100:null;const fill=share===null?0:Math.min(100,share);return <div key={row.label} className={row.value!==null&&row.limit!==null&&row.value>row.limit?'exceeds':''}><span>{row.label}</span><b>{row.value===null?'Belum diketahui':row.format(row.value)}{share!==null&&` · ${fmt(share)}%`}</b><small>Batas: {row.limit===null?'belum diisi':row.format(row.limit)}</small><div className="resource-meter-track" role="progressbar" aria-label={`${row.label} terhadap batas`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill}><span style={{width:`${fill}%`}}/></div></div>;})}
    {receivingArea!=null && footprint!==null && (footprint>receivingArea || (!otherFootprints.includes(null) && footprint+otherFootprints.reduce<number>((sum,v)=>sum+(v??0),0)>receivingArea)) && <p role="status">Ruang pemasangan pada {receiving?.name} melebihi luas zona ({fmt(receivingArea)} m²). Kurangi ruang atau pilih lokasi lain.</p>}
    {otherFootprints.includes(null)&&<small>Ruang penanganan lain di lokasi ini belum diketahui.</small>}
    <small>{dirty?'Belum disimpan.':'Angka sesuai data proyek.'}</small>
  </section>;
}

/** One active treatment, logical stages, persistent fields. All source choices have the same list/canvas equivalence. */
export function TreatmentComposer({ project, id, scenario, onProject, onCanvas, onSaved, onCancel, onDraftProject, onDirty, uncommitted = false }: { onDirty?:()=>void; uncommitted?: boolean; onCancel?: () => void; onDraftProject?: (p: ProjectV2) => void; project: ProjectV2; id: string; scenario: string; onProject: (p: ProjectV2) => void; onCanvas: (role: SelectionRole, onPick: (id: string) => void, soilOnly?: boolean) => void; onSaved?: (name:string,deferred?:boolean,invalidatedRoutes?:string[]) => void }) {
  const values = componentEditorValues(project, id, scenario)!;
  const c = values.component;
  const soilOnly = c.family === 'infiltration' && c.infiltrationType === 'biopori';
  const [, setStage] = useState(0), [picker, setPicker] = useState<SelectionRole | null>(null);
  const [targets, setTargets] = useState(c.targets), [site, setSite] = useState(c.treatment?.installationZoneId ?? (c.family === 'permeable' ? c.targets[0] ?? '' : ''));
  const [name, setName] = useState(c.name), [mode, setMode] = useState(c.treatment?.sharedSourceMode ?? 'unresolved');
  const [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [draftData,setDraftData] = useState<FormData|null>(null);
  const [draftVersion,setDraftVersion] = useState(0);
  const markDirty = () => { setSaved(false); onDirty?.(); setDraftVersion(version => version + 1); };
  const evidence = project.science?.interventions[id] ?? emptyInterventionEvidence();
  const perf = c.performanceByScenario[scenario];
  const basis = evidence.performance[scenario];
  const soil = project.zones.some(z => z.id === site && (z.surface === 'soil' || z.surface === 'vegetation')) ? project.science?.surfaces[site]?.soil.infiltration : undefined;
  const soilStale = referencedSoil(project, c, evidence).stale;
  const selectedC: ComponentVariant = { ...c, name, targets, treatment: { installationZoneId: site || null, sharedSourceMode: mode, allocationNote: c.treatment?.allocationNote ?? '' } };
  const conflicts = sharedSources(project, selectedC);
  const recipients = overflowChoices(project,id,scenario);
  const overflowId = evidence.overflow.kind === 'intervention' ? evidence.overflow.id : null;
  const invalidOverflow = overflowId !== null && !recipients.some(c=>c.id === overflowId);
  const initialSections=treatmentRequirements(project,c,scenario);
  const knowledgeKey=`tirta:intake:${project.id}:${id}:${scenario}`;
  const [task,setTask] = useState(()=>taskField(questionQueue(initialSections,{})[0]??'capacity'));
  const [flow,setFlow] = useState<'intake'|'guided'|'review'>(uncommitted?'intake':'guided');
  const [mapOpen,setMapOpen]=useState(false);
  const [answers,setAnswers]=useState<IntakeAnswers>(()=>{
    try {const stored=JSON.parse(localStorage.getItem(knowledgeKey)??'{}');const safe:IntakeAnswers={};for(const [key,value] of Object.entries(stored))if(['connection','capacity','site','cost','area'].includes(key)&&['yes','partly','unknown'].includes(String(value)))safe[key as keyof IntakeAnswers]=value as 'yes'|'partly'|'unknown';return safe;}catch{return {};}
  }),[visited,setVisited]=useState<string[]>([]);
  const [intakeIndex,setIntakeIndex]=useState(0),[feedback,setFeedback]=useState('');
  const [capacityReviewed,setCapacityReviewed]=useState(false),[soilEdited,setSoilEdited]=useState(false);
  const taskHeading=useRef<HTMLHeadingElement>(null);
  const [questionReturnVisible,setQuestionReturnVisible]=useState(false);
  const scrollToQuestion=(behavior:ScrollBehavior='smooth')=>taskHeading.current?.scrollIntoView({block:'start',behavior});
  // On mobile the active question is the work surface. Entering/reopening an intervention lands here,
  // instead of inheriting a stale document scroll position from the previous workspace.
  useEffect(()=>{
    if(!matchMedia('(max-width: 700px)').matches)return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>scrollToQuestion('auto'));});
    return()=>{cancelAnimationFrame(first);if(second)cancelAnimationFrame(second);};
  },[id]);
  useEffect(()=>{
    const mobile=matchMedia('(max-width: 700px)');
    const update=()=>{const rect=taskHeading.current?.getBoundingClientRect();setQuestionReturnVisible(mobile.matches&&!!rect&&rect.bottom<72);};
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
    return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  // Guided answers may move focus for accessibility, but must never move the viewport by themselves.
  const focusTask=()=>requestAnimationFrame(()=>taskHeading.current?.focus({preventScroll:true}));
  const [history,setHistory]=useState<string[]>([]);

  const formId = `treatment-${id}`;
  const pick = (role: SelectionRole, zoneId: string) => {
    if (role === 'installation' && zoneId && soilOnly && !bioporiInstallationAllowed(project.zones.find(z => z.id === zoneId)?.surface ?? 'roof')) { setError('Biopori tidak dapat dipasang pada Atap. Pilih lokasi non-atap.'); return; }
    if (role === 'source') setTargets(previous => [...new Set([...previous, zoneId])]);
    else if (role === 'conversion') { setTargets([zoneId]); setSite(zoneId); }
    else {setSite(zoneId);setCapacityReviewed(false);}
    setPicker(null); markDirty();
  };
  const switchStage = (next:number) => {setStage(next);setFlow('guided');setTask(next===2?'cost':next===1?'capacity':'source');setError('');};
  function prepare(data: FormData,deferred=false,validate=true):ProjectV2 {
    const invalidField = (stage: number, field: string, message: string): never => {
      switchStage(stage);setTask(taskField(field));
      const selector=['source','installation'].includes(field)?`[data-role-choice="${field}"]`:`[name="${field}"]`;
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${formId} ${selector}`)?.focus());
      throw new Error(message);
    };
    if (validate && soilOnly && site && !bioporiInstallationAllowed(project.zones.find(z => z.id === site)?.surface ?? 'roof')) invalidField(0, 'infiltrationType', 'Biopori tidak dapat dipasang pada Atap. Pilih lokasi non-atap.');
    if (validate && soilOnly && ['holeCount','holeDiameter','holeDepth'].some(key => String(data.get(key) ?? '').trim()) && !String(data.get('holeSource') ?? '').trim()) invalidField(1, 'holeSource', 'Isi dasar rencana fisik jika jumlah atau ukuran lubang sudah dinyatakan. Jika belum diketahui, kosongkan ukurannya.');
    if (validate && c.family === 'storage' && String(data.get('nominal') ?? '').trim() && !String(data.get('nominalSource') ?? '').trim()) invalidField(1, 'nominalSource', 'Isi dasar ukuran tangki jika kapasitas nominal sudah dinyatakan. Kapasitas nominal boleh dikosongkan.');
    const siteFormCurrent=data.get('siteContext')===site;
    const capacity = inputFrom(data, 'capacity');
    if(validate&&c.family!=='storage'&&!data.get('useZoneSoil')&&formText(data,'soil')) {
      if(formText(data,'soilOrigin')==='unknown'||!formText(data,'soilSource'))invalidField(1,'soilSource','Angka resapan tanah perlu dasar angka. Lengkapi asalnya atau kosongkan jika belum diketahui.');
      if(formText(data,'soilOrigin')==='measured'&&(!formText(data,'soilMethod')||!formText(data,'soilDate')))invalidField(1,'soilMethod','Lengkapi metode dan tanggal pengukuran tanah.');
    }
    if(validate&&formText(data,'capacityBasis')==='measured'&&(!formText(data,'performanceMethod')||!formText(data,'performanceDate')))invalidField(1,'performanceMethod','Kinerja terukur memerlukan metode dan tanggal pengukuran.');
    const via = String(data.get('via') ?? 'unknown') as Connection['via'];
    const routeNote = String(data.get('connectionSource') ?? '').trim();
    const routeLabels: Record<Connection['via'],string> = {unknown:'', 'gutter-downpipe':'Talang / pipa turun',edge:'Tepi permukaan',drain:'Saluran',other:'Jalur lain'};
    // A selected route is an explicit user declaration, not an inferred connection.
    const previousVia=project.science?.connections.find(link=>link.candidateId===id)?.via??'unknown';
    const previousRouteNote=project.science?.connections.find(link=>link.candidateId===id)?.source??'';
    const connectionSource = (via===previousVia || routeNote!==previousRouteNote ? routeNote : '') || (via !== 'unknown' ? `Jalur direncanakan pengguna: ${routeLabels[via]}.` : '');
    const resourceProject=project.installationSites.some(s=>s.id===c.installationSiteId)?project:sharedPlanningSpace(project);
    let p = saveComponent(resourceProject, { id, name: name.trim() || c.name, family: c.family, targets, siteId: c.installationSiteId ?? planningSpaceId(resourceProject), connection: c.family === 'permeable' ? 'Penggantian langsung pada zona yang dipilih pengguna.' : connectionSource, applicability: capacity.text ? (perf?.applicability || c.applicability || 'Kapasitas per kejadian dinyatakan pengguna; batas penerapan tercatat pada tinjauan.') : '', cost: inputFrom(data, 'cost', true), area: inputFrom(data, 'area'), capacity, scenarioId: scenario, reuse: null, infiltrationType: c.family === 'infiltration' ? c.infiltrationType ?? 'well' : undefined, waterUse: c.family === 'storage' ? String(data.get('waterUse')) as 'unknown' : undefined, drawdown: c.family === 'storage' ? String(data.get('drawdown')) as 'unknown' : undefined, plantingPlan: c.family === 'rain-garden' ? c.plantingPlan : undefined, treatment: { installationZoneId: site || null, sharedSourceMode: mode, allocationNote: String(data.get('allocationNote') ?? c.treatment?.allocationNote ?? ''), catchmentReviewed: c.family === 'permeable' ? null : data.get('catchmentReviewed') ? true : null } });
    // Reuse demand is never erased by a guided edit that does not ask about it.
    if (c.family === 'storage' && perf && 'reuse' in perf) { const pc = p.components.find(x => x.id === id)!; if (pc.family === 'storage') pc.performanceByScenario[scenario]!.reuse = perf.reuse; }
    const savedC = p.components.find(x => x.id === id)!;
    const currentPerf = savedC.performanceByScenario[scenario]!;
    const ref = 'availableStorage' in currentPerf ? currentPerf.availableStorage : 'infiltrationCapacity' in currentPerf ? currentPerf.infiltrationCapacity : currentPerf.additionalInfiltrationCapacity;
    const effectiveRef = p.scenarios.find(s => s.id === scenario)?.overrides.find(o => o.baseParameterId === ref.id)?.replacement ?? ref;
    const parameter = p.parameters.find(x => x.id === effectiveRef.id)!;
    p = updateScience(p, s => {
      const next = structuredClone(p.science?.interventions[id] ?? evidence);
      // The short path can state an assumption; it cannot downgrade a measured/design/literature review silently.
      const newBasis = String(data.get('capacityBasis') ?? 'unknown');
      const basisSource=formText(data,'capacityBasisSource') || capacity.source;
      const reviewChanged=newBasis!==(basis?.origin??'unknown') || basisSource!==(basis?.source??'') || formText(data,'performanceMethod')!==(basis?.method??'') || formText(data,'performanceDate')!==(basis?.date??'');
      if (siteFormCurrent && parameter.value !== null && (reviewChanged || data.get('capacityReviewed')==='yes')) next.performance[scenario] = { origin: newBasis as 'unknown', source: newBasis==='unknown'?'':basisSource, subgradeDependent: c.family === 'permeable' ? basis?.subgradeDependent ?? null : null, parameterId: parameter.id, parameterRevision: parameter.revision, ...scientificScenarioContext(p, scenario), method:formText(data,'performanceMethod'),date:formText(data,'performanceDate') };
      if(c.family!=='storage' && siteFormCurrent) {
        if(!data.get('useZoneSoil') && (!soilStale || data.get('soilChanged')==='yes')) {
          try {next.soilInfiltration=numberFromForm(data,'soil','mm/h');} catch(cause) {if(validate)throw cause;}
        }
        next.groundwaterAssessment=formText(data,'groundwaterAssessment') as typeof next.groundwaterAssessment;
        next.groundwaterBasis=formText(data,'groundwaterBasis');
        next.localStandardReview=formText(data,'standardReview') as typeof next.localStandardReview;
        next.localStandardBasis=formText(data,'standardBasis');
      }
      if(siteFormCurrent) {
      next.condition=formText(data,'condition') as typeof next.condition;
      next.maintenance=formText(data,'maintenance');
      next.fieldVerified=formText(data,'fieldVerified')==='unknown'?null:formText(data,'fieldVerified')==='yes';
      next.verificationSource=formText(data,'verificationSource');
      }
      if(c.family==='rain-garden'){next.media=formText(data,'media');next.vegetation=formText(data,'vegetation');}

      if (c.family === 'storage' && (String(data.get('nominal') ?? '') !== String(evidence.nominalTankCapacity.value ?? '') || String(data.get('nominalSource') ?? '') !== evidence.nominalTankCapacity.source)) next.nominalTankCapacity = String(data.get('nominal') ?? '').trim() ? { value: Number(data.get('nominal')), unit: 'm3', origin: 'user_supplied', source: String(data.get('nominalSource') ?? ''), method: '', date: '' } : { value: null, unit: 'm3', origin: 'unknown', source: '', method: '', date: '' };
      const overflow = String(data.get('overflow') ?? 'unknown');
      next.overflow = destinationSchema.parse(overflow.startsWith('zone:') ? { kind: 'zone', id: overflow.slice(5) } : overflow.startsWith('intervention:') ? { kind: 'intervention', id: overflow.slice(13) } : overflow === 'outside' || overflow === 'drainage' ? { kind: overflow, note: String(data.get('overflowSource') ?? '') } : { kind: 'unknown' });
      if ((site || null) !== (c.treatment?.installationZoneId ?? null) || (data.get('soilChoicePresent') && !data.get('useZoneSoil') && (!soilStale || data.get('soilChanged')==='yes'))) delete next.soilReference;
      if (data.get('useZoneSoil') && soil?.value !== null && soil) next.soilReference = { zoneId: site, confirmation: String(data.get('soilConfirmation') ?? ''), observation: structuredClone(soil) };
      if (c.family === 'infiltration' && c.infiltrationType === 'biopori') {
        const number = (key: string) => String(data.get(key) ?? '').trim() ? Number(data.get(key)) : null;
        const physical = { count: number('holeCount'), diameterCm: number('holeDiameter'), depthCm: number('holeDepth'), source: String(data.get('holeSource') ?? '').trim() };
        const hasPhysical = physical.count !== null || physical.diameterCm !== null || physical.depthCm !== null || !!physical.source;
        if (hasPhysical) next.biopori = physical;
        else if (next.biopori) delete next.biopori;
      }
      s.interventions[id] = next;
      const previousLinks = s.connections.filter(link => link.candidateId === id);
      const first = previousLinks[0];
      const routeChanged = via !== (first?.via ?? 'unknown') || connectionSource !== (first?.source ?? '');
      s.connections = s.connections.filter(link => link.candidateId !== id);
      if (c.family !== 'permeable') for (const zoneId of targets) {
        const existing = previousLinks.find(link => link.sourceZoneId === zoneId);
        if (existing && !routeChanged) { s.connections.push(existing); continue; }
        s.connections.push({ id: `candidate-${id}-${zoneId}`, sourceZoneId: zoneId, candidateId: id, destination: via !== 'unknown' && connectionSource ? { kind: 'intervention', id } : { kind: 'unknown' }, via, origin: via !== 'unknown' && connectionSource ? 'user_supplied' : 'unknown', source: connectionSource });
      }
    });
    // Alternative means mutually exclusive choices, including the reverse relationship.
    const others = sharedSources(p, savedC).map(x => x.id);
    for (const component of p.components) {
      if (component.id === id) component.excludes = mode === 'alternative' ? [...new Set([...component.excludes, ...others])] : component.excludes.filter(x => !others.includes(x));
      else if (others.includes(component.id)) { component.excludes = mode === 'alternative' ? [...new Set([...component.excludes, id])] : component.excludes.filter(x => x !== id);
        if (mode === 'ledger' && component.treatment) component.treatment = { ...component.treatment, sharedSourceMode: 'ledger', allocationNote: String(data.get('allocationNote') ?? c.treatment?.allocationNote ?? '') };
      }
    }
    // Save the same parsed transaction before explicitly removing this idea from
    // consideration. Do not toggle the previous project and lose unsaved inputs.
    p=reviewLegacySite(project,p,id);
    p=setActiveComponents(p,[...p.components.filter(item=>item.enabled&&item.id!==id).map(item=>item.id),...(deferred?[]:[id])]);
    return p;
  }
  const stageWorkingDraft = useEffectEvent(() => {
    if (!onDraftProject) return;
    const form=document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const data=new FormData(form);
    setDraftData(data);
    try { onDraftProject(prepare(data,false,false)); } catch { /* Invalid partial text stays local until valid. */ }
  });
  useEffect(()=>{
    if (!draftVersion) return;
    const frame=requestAnimationFrame(()=>stageWorkingDraft());
    return()=>cancelAnimationFrame(frame);
  },[draftVersion]);
  function save(data:FormData,deferred=false) {
    const p=prepare(data,deferred);
    const affected = invalidatedDestinationLabels(project, p);
    onProject(p);setDraftData(null);setSoilEdited(false);setCapacityReviewed(false); setSaved(true); setError(''); onSaved?.(p.components.find(item => item.id === id)!.name,deferred,affected);
  }
  const kind = c.family === 'storage' ? 'tank' : c.family === 'infiltration' ? c.infiltrationType === 'biopori' ? 'biopori' : 'soak' : c.family === 'rain-garden' ? 'garden' : 'porous';
  let preview=project;let previewInvalid=false;
  if(draftData) {const copy=new FormData();for(const [key,value] of draftData.entries())copy.append(key,value);try {preview=prepare(copy,false,false);} catch { previewInvalid=true; /* Invalid text never becomes scientific input. */ }}
  const previewC:ComponentVariant={...preview.components.find(item=>item.id===id)!,name,targets,treatment:{...preview.components.find(item=>item.id===id)?.treatment,installationZoneId:site||null,sharedSourceMode:mode,allocationNote:preview.components.find(item=>item.id===id)?.treatment?.allocationNote??''}};
  const requirements=treatmentRequirements(preview,previewC,scenario);
  if(previewInvalid)for(const group of requirements)for(const row of group.rows)if(["capacity","capacitySource","capacityBasis","cost","area"].includes(row.field)){row.status="invalid";row.value="Isian belum dapat digunakan";}
  const rows=requirements.flatMap(section=>section.rows);
  const needsAttention=(row:typeof rows[number])=>row.status==='invalid'||(row.required&&row.status!=='known');
  const queue=questionQueue(requirements,answers,visited);
  const intake=intakeQuestions(treatmentRequirements(project,c,scenario));
  const focused=rows.find(row=>taskField(row.field)===task);
  const check=assessIntervention(preview,previewC,scenario,preview.parameters,undefined,false);
  // A candidate-only calculation view. Reopening an inactive draft must not
  // enable it in the project or pass a disabled component to snapshotPlan.
  const localProject={...preview,components:preview.components.map(item=>item.id===id?{...previewC,enabled:true}:item)};
  const localReadiness=fieldDecisionReadiness(localProject,scenario).treatments.find(item=>item.id===id);
  const mini=evaluateEventPlan(localProject,snapshotPlan(localProject,[id],'guided-preview','Isian penanganan'),scenario);
  const sourceFact=sourceRunoffFact(localProject,scenario,targets);
  const jump=(field:string)=>{
    if(['budget','land','allocatedSpace'].includes(field)){document.querySelector<HTMLButtonElement>('.intervention-limit-summary header button')?.click();requestAnimationFrame(()=>document.querySelector<HTMLInputElement>(`dialog[open] [name=${field==='budget'?'budget':'land'}]`)?.focus());return;}
    setHistory(previous=>[...previous,task]);setTask(taskField(field));setFlow('guided');setError('');setFeedback('');
    focusTask();
    if(field==='capacitySource')requestAnimationFrame(()=>{const form=document.getElementById(formId),details=form?.querySelector<HTMLDetailsElement>('[data-task=capacity] .number-source');if(details){details.open=true;details.querySelector<HTMLSelectElement>('select')?.focus();}});
  };
  const focusRequested=useEffectEvent((event:Event)=>{
    const detail=(event as CustomEvent<{componentId:string;field:string}>).detail;
    if(detail?.componentId!==id||!Object.hasOwn(taskQuestions,taskField(detail.field)))return;
    setPicker(null);setMapOpen(false);jump(detail.field);
  });
  useEffect(()=>{const handler=(event:Event)=>focusRequested(event);window.addEventListener('tirta-treatment-focus',handler);return()=>window.removeEventListener('tirta-treatment-focus',handler);},[]);
  const next=(defer=false)=>{
    const form=document.getElementById(formId) as HTMLFormElement|null;
    if(!form)return;
    const data=new FormData(form);if(task==='capacityBasis'&&!defer){data.set('capacityReviewed','yes');markDirty();}setDraftData(data);
    let effectiveRequirements=requirements;
    try {
      const prepared=prepare(data,false,false);
      const preparedC:ComponentVariant={...prepared.components.find(item=>item.id===id)!,name,targets,treatment:{...prepared.components.find(item=>item.id===id)?.treatment,installationZoneId:site||null,sharedSourceMode:mode,allocationNote:prepared.components.find(item=>item.id===id)?.treatment?.allocationNote??''}};
      effectiveRequirements=treatmentRequirements(prepared,preparedC,scenario);
    } catch {/* Invalid text remains on the current step. */}
    const effectiveRows=effectiveRequirements.flatMap(section=>section.rows);
    const currentRows=effectiveRows.filter(r=>taskField(r.field)===task);
    let following:string|undefined;
    const soilValue=numericInput(formText(data,'soil'));
    if(task==='soil'&&!defer&&!data.get('useZoneSoil')&&soilValue.ok&&soilValue.value!==null&&soilValue.value>0)following='soilEvidence';
    if(task==='soilEvidence'&&!defer&&data.get('soilOrigin')==='measured')following='soilMeasurement';
    if(task==='capacityBasis'&&!defer&&data.get('capacityBasis')==='measured'&&(!formText(data,'performanceMethod')||!formText(data,'performanceDate')))following='performanceMethod';
    const missingRequired=currentRows.find(row=>!following&&row.required&&row.status==='missing');
    if(missingRequired&&!defer){
      setFeedback(`${missingRequired.label} diperlukan ${missingRequired.consequence==='water'?'untuk menghitung air':missingRequired.consequence==='comparison'?'untuk membandingkan paket':'karena kondisi yang diisi perlu diperiksa'}. Lengkapi data ini sebelum melanjutkan.`);
      setFlow('guided');focusTask();return;
    }
    const invalidAdvisory=currentRows.find(row=>!following&&row.status==='invalid');
    const row=currentRows[0]??rows.find(r=>taskField(r.field)===task);
    setFeedback(defer?'Diisi nanti. Data yang belum diketahui tetap tercatat pada kebutuhan.':invalidAdvisory?`${invalidAdvisory.message??`${invalidAdvisory.label} perlu diperiksa.`} Anda tetap dapat melanjutkan; paket belum dianggap siap sampai kondisi ini diperbaiki.`:row?.status==='known'?`${row.label}: ${row.value}`:following?'Lanjutkan dasar data ini pada langkah berikutnya.':row?.consequence==='comparison'?'Isian tetap di langkah ini; hitungan air diperiksa terpisah.':'Lanjut ke kebutuhan berikutnya.');
    setHistory(previous=>[...previous,task]);
    if(task==='capacityBasis'&&!defer)setCapacityReviewed(true);
    const done=[...new Set([...visited,task,...effectiveRows.filter(r=>taskField(r.field)===task).map(r=>r.field)])];setVisited(done);
    following??=questionQueue(effectiveRequirements,answers,done)[0];
    if(following){setTask(taskField(following));setFlow('guided');}else setFlow('review');
    focusTask();
  };
  const unknown=()=>next(true);
  const answerIntake=(value:'yes'|'partly'|'unknown')=>{
    const q=intake[intakeIndex];if(!q)return;
    const result={...answers,[q.id]:value};setAnswers(result);
    try{localStorage.setItem(knowledgeKey,JSON.stringify(result));}catch{/* Core answers save through project persistence. */}
    if(intakeIndex+1<intake.length)setIntakeIndex(intakeIndex+1);
    else{setTask(taskField(questionQueue(requirements,result)[0]??'source'));setFlow('guided');}
  };
  const extraTasks:[string,string][]=[['routeNote','Catatan jalur'],['name','Nama penanganan']];
  if(c.family==='storage')extraTasks.push(['nominal','Ukuran tangki']);
  if(soilOnly)extraTasks.push(['holes','Jumlah lubang'],['holeDimensions','Ukuran lubang']);
  const title=flow==='intake'?'Apa yang sudah Anda ketahui?':flow==='review'?'Tinjau penanganan Anda':task==='capacity'&&c.family==='storage'?'Berapa ruang kosong tangki saat hujan mulai?':taskQuestions[task]??'Tinjau isian penanganan';
  const surfaceLabel:Record<string,string>={roof:'Atap',paved:'Beton/Aspal',soil:'Tanah terbuka',vegetation:'Vegetasi',porous:'Permukaan berpori'};
  const sourceZones=targets.map(zoneId=>localProject.zones.find(z=>z.id===zoneId)).filter((z):z is ProjectV2['zones'][number]=>!!z);
  const sourcePrimary=sourceZones[0],sourceSurface=sourcePrimary?.surface?(surfaceLabel[sourcePrimary.surface]??sourcePrimary.surface):'Permukaan belum dipilih',sourceLabel=sourcePrimary?`${sourcePrimary.name} ? ${sourceSurface}`:'Sumber belum dipilih';
  const sourceExtra=Math.max(0,sourceZones.length-1);
  const routeLinks=(localProject.science?.connections??[]).filter(link=>link.candidateId===c.id&&targets.includes(link.sourceZoneId));
  const routeKnown=targets.length>0&&targets.every(zoneId=>routeLinks.some(link=>link.sourceZoneId===zoneId&&link.via!=='unknown'));
  const routeKinds=[...new Set(routeLinks.filter(link=>link.via!=='unknown').map(link=>link.via))];
  const routeNames:Record<string,string>={'gutter-downpipe':'Talang / pipa turun',edge:'Tepi permukaan',drain:'Saluran',other:'Jalur lain'};
  const routeLabel=!targets.length?'Menunggu sumber':!routeKnown?'Jalur belum lengkap':routeKinds.length===1?(routeNames[routeKinds[0]!]??'Jalur dinyatakan'):'Beberapa jalur dinyatakan';
  const pathEvidence=localProject.science?.interventions[id]??evidence;
  const overflow=pathEvidence.overflow;
  const overflowLabel=overflow.kind==='zone'?(localProject.zones.find(z=>z.id===overflow.id)?.name??'Zona tujuan tidak aktif'):overflow.kind==='intervention'?(localProject.components.find(item=>item.id===overflow.id&&item.enabled)?.name??'Intervensi tujuan tidak aktif'):overflow.kind==='drainage'?'Saluran':overflow.kind==='outside'?'Keluar persil':'Tujuan luapan belum diperiksa';
  const overflowKnown=overflow.kind!=='unknown'&&!invalidOverflow;
  const installationLabel=localProject.zones.find(z=>z.id===site)?.name??'Lokasi belum dipilih';
  const waterMissing=requirements.find(group=>group.id==='connection')?.rows.filter(row=>row.consequence==='water'&&row.status!=='known').length??0;
  return <section className="treatment-composer guided-composer" aria-label={`Rancang ${c.name}`} data-flow={flow} data-mode="guided">
    <header className="treatment-heading"><InterventionArt kind={kind}/><div><h2 title={name}>{name}</h2><p>{targets.map(zoneId=>project.zones.find(z=>z.id===zoneId)?.name??'Zona terhapus').join(' + ')||'Sumber belum dipilih'} → {project.zones.find(z=>z.id===site)?.name??'Lokasi belum dipilih'}</p></div></header>
   <nav className="guided-progress" aria-label="Ringkasan kebutuhan">{requirements.map(group=>{const missing=group.rows.filter(needsAttention).length,target=group.rows.find(r=>r.status==='invalid')??group.rows.find(r=>r.required&&r.status!=='known')??group.rows[0];return <button key={group.id} type="button" onClick={()=>target&&jump(target.field)}><b>{group.label}</b><span>{missing?`${missing} data belum lengkap`:'Data utama siap'}</span></button>;})}</nav>
    {questionReturnVisible&&<button type="button" className="mobile-question-return" aria-controls={`${formId}-active-question`} onClick={()=>scrollToQuestion(matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth')}><ArrowUp size={15} aria-hidden="true"/>Kembali ke pertanyaan</button>}
    <div className="guided-layout">
      <PlanningNumberForm id={formId} fields={[{name:'capacity',label:'Kapasitas',unit:'m³/event',initial:values.capacity.text},{name:'cost',label:'Biaya',unit:'Rp',initial:values.cost.text},{name:'area',label:'Ruang',unit:'m²',initial:values.area.text}]} onChange={ev=>{if((ev.target as HTMLElement).closest<HTMLElement>('[data-task]')?.dataset.task?.startsWith('soil'))setSoilEdited(true);markDirty();setError('');}} onInvalidCapture={ev=>{ev.preventDefault();const control=ev.target as HTMLElement;const section=control.closest<HTMLElement>('[data-task]');if(section){setFlow('guided');setTask(section.dataset.task!);setError('Periksa angka pada langkah ini.');requestAnimationFrame(()=>control.focus());}}} onSubmit={ev=>{ev.preventDefault();try{save(new FormData(ev.currentTarget),(ev.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='later');}catch(cause){setError(planningError(cause));}}}>
        <input type="hidden" name="siteContext" value={site}/><input type="hidden" name="capacityReviewed" value={capacityReviewed?'yes':'no'}/><input type="hidden" name="soilChanged" value={soilEdited?'yes':'no'}/>
        <div className="guided-task-surface">
          <span className="guided-purpose">{flow==='intake'?'KENALI DATA ANDA':flow==='review'?'SEBELUM DITERAPKAN':focused?.consequence==='comparison'?'UNTUK BANDINGKAN':focused?.consequence==='field'?'CEK LAPANGAN':'UNTUK HITUNG AIR'}</span>
          <h3 id={`${formId}-active-question`} tabIndex={-1} ref={taskHeading}>{title.slice(0,title.lastIndexOf(' ')+1)}<span className="reference-intake-highlight">{title.slice(title.lastIndexOf(' ')+1)}</span></h3>
          {flow==='intake'?<div className="guided-intake"><p>{intake[intakeIndex]?.title??'Data utama sudah tersedia.'}</p>{intake.length>0?<div className="intake-choices"><button type="button" onClick={()=>answerIntake('yes')}>Sudah</button><button type="button" onClick={()=>answerIntake('partly')}>Sebagian</button><button type="button" onClick={()=>answerIntake('unknown')}>Belum tahu</button></div>:<button type="button" onClick={()=>setFlow('review')}>Tinjau data</button>}<small>Pilihan ini mengatur urutan pertanyaan, bukan mengisi angka.</small><button type="button" className="text-button" onClick={()=>{setFlow('guided');setTask(taskField(queue[0]??'source'));}}>Langsung mulai</button></div>:flow==='review'?<div className="guided-review"><p>{localReadiness?.calculationReady?'Dampak air dapat dihitung.':'Dampak air belum dapat dihitung.'}</p><p>{localReadiness?.calculationActions[0]?.question??(localReadiness?.comparisonReady?'Data perbandingan tersedia.':'Lengkapi biaya dan ruang untuk perbandingan.')}</p><button type="button" className="text-button" onClick={()=>jump(taskField(queue[0]??'capacity'))}>Lanjutkan pengisian</button><label>Nama penanganan<input value={name} onChange={ev=>{setName(ev.target.value);markDirty();}} maxLength={120}/></label></div>:null}
          <GuidedTreatmentFields project={project} c={c} scenario={scenario} task={flow==='guided'?task:''} targets={targets} site={site} mode={mode} name={name} setTargets={v=>{setTargets(v);markDirty();}} setSite={v=>{setSite(v);markDirty();}} setMode={v=>{setMode(v);markDirty();}} setName={v=>{setName(v);markDirty();}} onPick={setPicker} conflicts={conflicts} invalidOverflow={invalidOverflow} recipients={recipients} soilStale={soilStale}/>
          {flow==='guided'&&focused?.why&&<details className="guided-why"><summary>Mengapa TIRTA menanyakan ini?</summary><p>{focused.why}</p></details>}
          {['budget','land','allocatedSpace'].includes(task)&&flow==='guided'&&<button type="button" onClick={()=>jump(task)}>Tinjau batas proyek</button>}
          {feedback&&<p className="guided-feedback" role="status">{feedback}</p>}
          {error&&<p className="field-error" role="alert">{error}</p>}
        </div>
        <footer className="composer-command-dock">
          <div className="composer-command-main">
            <button type="button" className="btn-back" disabled={!history.length&&flow!=='review'} onClick={()=>{setFlow('guided');setTask(history.at(-1)??'source');setHistory(previous=>previous.slice(0,-1));setError('');}}>Sebelumnya</button>
            {flow==='guided'&&!rows.some(r=>taskField(r.field)===task&&(r.status==='invalid'||r.consequence==='water'&&r.required))&&<button type="button" className="text-button btn-ghost command-unknown" onClick={unknown}>Belum tahu · lanjut</button>}
            <span className="composer-command-spacer" aria-hidden="true"/>
            {flow==='guided'?<button type="button" className="primary btn-primary" onClick={()=>next()}>Selanjutnya<ArrowRight size={17}/></button>:<button type="submit" value="save" className="primary btn-primary">{uncommitted?'Tambahkan ke rencana':'Simpan penanganan'}<ArrowRight size={17}/></button>}
          </div>
          <div className="composer-command-utilities"><button type="submit" value="later" className="text-button btn-ghost">Simpan untuk nanti</button><button type="button" className="text-button btn-ghost" onClick={()=>setMapOpen(!mapOpen)}>Semua kebutuhan</button>{onCancel&&<button type="button" className="btn-cancel" onClick={onCancel}>Batal</button>}</div>
        </footer>
        <section className="guided-water-path" aria-label="Alur penanganan yang sedang dirancang">
          <header><span>ALUR YANG SEDANG DIRANCANG</span></header>
          <div className="guided-water-path-track">
            <div className={`water-path-node ${sourcePrimary?'known':'pending'}`}><small>Sumber limpasan</small><strong title={sourceZones.map(z=>z.name).join(', ')}>{sourceLabel}{sourceExtra>0&&` +${sourceExtra}`}</strong></div>
            <ArrowRight className="water-path-arrow" size={18} aria-hidden="true"/>
            <div className={`water-path-node ${routeKnown?'known':'pending'}`}><small>Jalur air</small><strong>{routeLabel}</strong></div>
            <ArrowRight className="water-path-arrow" size={18} aria-hidden="true"/>
            <div className="water-path-node treatment"><small>{installationLabel}</small><strong>{name}</strong></div>
            <ArrowRight className="water-path-arrow" size={18} aria-hidden="true"/>
            <div className={`water-path-node ${overflowKnown?'known':'pending'}`}><small>Setelah penanganan</small><strong>{overflowLabel}</strong></div>
          </div>
          {waterMissing>0&&<footer><span>{waterMissing} hal untuk hitung air masih perlu dilengkapi</span></footer>}
        </section>
      </PlanningNumberForm>
      <aside className="guided-status" aria-label="Kebutuhan dan hasil penanganan">
        <div className="guided-mini-result" aria-live="polite"><h3>{!previewInvalid&&mini.ok?'Dampak isian ini':'Belum dihitung'}</h3>{!previewInvalid&&mini.ok?<strong>{fmt(mini.value.residual)} m³ <small>sisa limpasan persil</small></strong>:<p>{localReadiness?.calculationActions[0]?.question??check.missing[0]?.message??'Periksa isian yang belum lengkap.'}</p>}<small>{uncommitted||draftData?'Pratinjau · belum diterapkan':'Data diterapkan'} · {localReadiness?.comparisonReady?'Siap dibandingkan':'Perbandingan belum siap'}</small></div>
        {sourceFact!==null&&<p className="guided-source-fact">Limpasan sumber: <b>{fmt(sourceFact)} m³</b><small>Pada hujan aktif · belum merupakan air yang ditangani.</small></p>}
        <div className="guided-known-values">{rows.filter(r=>['capacity','cost','area'].includes(r.field)).map(row=><div key={row.field}><span>{row.label}</span><b>{row.status==='known'?row.value:'Belum diketahui'}</b></div>)}</div>
        <ResourceDraft project={localProject} componentId={id} installationZoneId={site}/>
        <div className="treatment-requirements guided-map guided-map-summary" aria-label="Yang TIRTA gunakan"><h3>Kesiapan penanganan</h3><div className="guided-readiness-summary">{requirements.map(group=>{const invalid=group.rows.filter(row=>row.status==='invalid').length,missing=group.rows.filter(row=>row.required&&row.status!=='known'&&row.status!=='invalid').length,target=group.rows.find(row=>row.status==='invalid')??group.rows.find(row=>row.required&&row.status!=='known')??group.rows[0];return <button key={group.id} type="button" data-status={invalid?'invalid':missing?'missing':'known'} onClick={()=>target&&jump(target.field)}><span>{group.label}</span><b>{invalid?`${invalid} perlu diperiksa`:missing?`${missing} belum lengkap`:'Siap'}</b></button>})}</div><button type="button" className="guided-all-needs" onClick={()=>setMapOpen(true)}>Lihat semua kebutuhan</button></div>
     </aside>
    </div>
    {saved&&<p role="status" className="composer-saved">Perubahan diterapkan.</p>}
    <div className="composer-details support-rail"><HelpButton topic="methods" method={kind==='tank'?'storage':kind==='soak'?'infiltration':kind==='garden'?'garden':kind==='biopori'?'biopori':'permeable'} label="Kenapa?"/><InterventionScience project={preview} id={id} scenarioId={scenario} staged={!!onDraftProject} onProject={p=>{setSaved(false);onDirty?.();(onDraftProject??onProject)(p);requestAnimationFrame(()=>{const form=document.getElementById(formId);if(form instanceof HTMLFormElement)setDraftData(new FormData(form));});}} includeResources={false}/></div>
    {mapOpen&&<ContextDialog title="Semua kebutuhan penanganan" className="all-needs-dialog" onClose={()=>setMapOpen(false)}><div className="guided-full-map">{requirements.map(group=>{const ready=group.rows.filter(row=>row.status==='known').length;return <section className="needs-group" key={group.id}><header><h3>{group.label}</h3><span>{ready}/{group.rows.length} siap</span></header><div className="needs-group-rows">{group.rows.map(row=><button className="need-row" data-status={row.status} type="button" key={row.field} onClick={()=>{setMapOpen(false);jump(row.field);}}><span className="need-row-label"><i aria-hidden="true">{row.status==='known'?'✓':row.status==='invalid'?'!':'○'}</i>{row.label}</span><b>{row.value}</b><small>{row.status==='invalid'&&row.message?row.message:!row.required&&row.status!=='invalid'?'Tambahan':row.consequence==='water'?'Untuk hitung air':row.consequence==='comparison'?'Untuk bandingkan':'Cek lapangan'}</small></button>)}</div></section>})}{extraTasks.length>0&&<div className="needs-optional-tasks"><span>Isian tambahan</span>{extraTasks.map(([field,label])=><button type="button" key={field} onClick={()=>{setMapOpen(false);jump(field);}}>{label}</button>)}</div>}</div></ContextDialog>}
    {picker&&<ZoneRolePicker project={project} soilOnly={soilOnly} role={picker} onClose={()=>setPicker(null)} onPick={zoneId=>pick(picker,zoneId)} onCanvas={()=>{const role=picker;setPicker(null);onCanvas(role,zoneId=>pick(role,zoneId),soilOnly);}}/>}
  </section>;
}
