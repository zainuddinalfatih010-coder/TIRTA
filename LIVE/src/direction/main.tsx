import {TirtaNavigator} from './TirtaNavigator';
import {useTirtaNavigator} from './useTirtaNavigator';
import { SimpleAreaEntry } from './SimpleAreaEntry';
import { FieldObservationControl } from './FieldObservationControl';
import { FieldDecisionReadiness } from './FieldDecisionReadiness';
import { productState } from "../domain/productState";
import { runoffHighlights } from "../domain/alternativeHighlight";
import { resourceLimitStatus } from "../domain/resourceLimits";
import { type FieldDecisionAction } from '../domain/fieldDecisionReadiness';
import { TreatmentComposer, type SelectionRole } from './TreatmentComposer';
import { duplicateTreatment, invalidatedDestinationLabels } from '../domain/treatmentLifecycle';
import { planningError } from './planningError';
import { addTreatment, bioporiInstallationAllowed, treatmentPlacementIssue } from '../domain/treatmentDesign';
import { exploreTreatment, editTreatment, commitTreatmentEdit, rebaseTreatmentEditLimits, deleteTreatment, type TreatmentEdit } from '../domain/treatmentEditing';
import { RainWorkspace } from "./RainWorkspace";
import { PlanningAssistant } from "./PlanningAssistant";
import { InterventionWorkspace, InterventionArt, InterventionNavigator, PlanningSupport } from "./InterventionWorkspace";
import { WorkbenchNavigation } from "./WorkbenchNavigation";
import { ComparisonWorkbench } from "./ComparisonWorkbench";
import { ContextDialog } from "./ContextDialog";
import { PlanWorkbench } from "./PlanWorkbench";
import {planImplementationChecks} from '../domain/planClosure';
import { PlanSummary, PlanTargets, PlanRecommendationPanel } from "./PlanSummary";
import { PlanWaterFlow } from "./PlanWaterFlow";
import "./comparison-workbench.css";
import { ProjectScenarioChart } from "./ScientificCharts";
import { ZoneNavigator } from "./ZoneNavigator";
import { PlanScreening } from './PlanScreening';
import { SurfaceScience, RainScience } from './SurfaceScience';
import { FieldEvaluationPanel } from './FieldEvaluationPanel';
import { StudioInspector, type StudioInspectorHandle } from "./StudioInspector";
import { ProjectReportDialog } from "./ProjectReportDialog";
import { forwardIssues, workflowReadiness, type ReadinessIssue } from "../domain/workflowReadiness";
import { ZoneDataFields } from "./ZoneDataFields";
import { discardRetiredModelCache } from '../persistence/retiredModelCache';
import { ReadinessGuide, readinessFieldSelector } from "./ReadinessGuide";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CalculationSource } from "./CalculationSource";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CloudRain,
  Droplets,
  FileCheck2,
  FolderOpen,
  Layers3,
  LayoutGrid,
  Map,
  Pencil,
  Scale,
  ClipboardList,
  SlidersHorizontal,
  SquareDashed,
  X,
} from "lucide-react";
import { containsPoint } from "../domain/geometry";
import { visualLabelAnchor } from "./labelLayout";
import { surfaceLabels, type Point, type Surface } from "../domain/model";
import { updateShapeData } from "../domain/authoring";
import { deleteRainScenario, readInput, saveRain } from "../domain/planningAuthoring";
import { numericInput } from "../domain/validation";
import { Parcel, materials } from "./Parcel";
import {
  Missing,
} from "./Visuals";
import {
  alternativeSearch,
  componentEditorValues,
  currentDemoProject,
  evaluate,
  fmt,
  money,
  options,
  setActiveComponents,
  type OptionId,
  type Snapshot,
} from "./productionBridge";
import { useGoldenProject } from "./useGoldenProject";
import { ProjectLanding } from "./ProjectLanding";
import { LocalProjectList } from "./LocalProjectList";
import { RainTemplates, rainAssumptionSource } from "./RainTemplates";
import { ConstraintEditor, ProjectSources } from "./ProductionControls";
import { productionBaseline } from "../domain/productionBaseline";
import { evaluatePlan, evaluateEventPlan, snapshotPlan, planningFingerprint } from "../domain/planningEngine";
import { evaluationFromBalance } from "./productionBridge";
import { decisionInterpretation, decisionPhotoProvenance, decisionVerificationItems, evidenceLabel } from "./decisionFeedback";
import { prepareParcelPackage } from "./prepareParcelPackage";
import { AlternativeExplanation, ContextualAdvice, DecisionConclusion, PackageAdvisor, PackageOutcome, PlanningIntent, SearchExplanation, VariantLibrary } from "./DecisionSupport";
import "./direction.css";
import "./production-controls.css";
import "./visual-comfort.css";
import "./branding.css";
import "./planning-workspace.css";
import "./scientific-controls.css";
import "./bidang-air.css";
import "./scientific-charts.css";
import "./image-match.css";
import "./plan-workbench.css";
import "./project-landing.css";
import "./landing-floor.css";
import "./motion-system.css";
import "./scrollbars.css";
import { TirtaHelpProvider, HelpButton } from "./TirtaHelp";
const routes = [
  { id: "project", label: "Proyek", icon: FolderOpen },
  { id: "studio", label: "Studio Persil", icon: Map },
  { id: "rain", label: "Hujan & kondisi awal", icon: CloudRain },
  { id: "interventions", label: "Intervensi", icon: SlidersHorizontal },
  { id: "alternatives", label: "Alternatif", icon: LayoutGrid },
  { id: "compare", label: "Bandingkan", icon: Scale },
  { id: "impact", label: "Rencana & Dampak", icon: FileCheck2 },
] as const;
type Route = (typeof routes)[number]["id"];
const completionGate: Record<Route, Route> = { project: "studio", studio: "rain", rain: "interventions", interventions: "alternatives", alternatives: "compare", compare: "compare", impact: "impact" };
function routeFromUrl(): Route {
  const id = new URLSearchParams(location.search).get("view");
  return id === "compare" ? "alternatives" : routes.find((r) => r.id === id)?.id ?? "project";
}
function App() {
  const store = useGoldenProject();
  const { state } = store;
  const [projectName, setProjectName] = useState("");
  const [route, setRoute] = useState<Route>("project");
  useEffect(() => {
    const root = document.documentElement;
    let hideTimer: number | undefined;
    const revealPageScrollbar = () => {
      root.classList.add("page-scrollbar-active");
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => root.classList.remove("page-scrollbar-active"), 2300);
    };
    const revealNearEdge = (event: MouseEvent) => {
      if (event.clientX >= window.innerWidth - 24) revealPageScrollbar();
    };
    window.addEventListener("scroll", revealPageScrollbar, { passive: true });
    window.addEventListener("mousemove", revealNearEdge, { passive: true });
    return () => {
      window.removeEventListener("scroll", revealPageScrollbar);
      window.removeEventListener("mousemove", revealNearEdge);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      root.classList.remove("page-scrollbar-active");
    };
  }, []);
  const [navigatorOpen,setNavigatorOpen]=useState(()=>new URLSearchParams(location.search).get('view')==='navigator');
  const [navigatorClosing,setNavigatorClosing]=useState(false);
  const navigatorCloseTimer=useRef<number|null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(() => new URLSearchParams(location.search).get('view') === 'assistant');
  const [recommendationRequested,setRecommendationRequested]=useState(false);
  const [selected, setSelected] = useState("");
  const [zoneRename, setZoneRename] = useState<{ id: string; value: string } | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [roleSelection, setRoleSelection] = useState<{ role: SelectionRole; onPick: (id: string) => void; soilOnly?: boolean } | null>(null);
  const [guidanceFocus,setGuidanceFocus]=useState<{field:string}|null>(null);
  const [placing, setPlacing] = useState<OptionId | null>(null);
  const [activeIntervention, setActiveIntervention] = useState("");
  const [treatmentSelectionCleared, setTreatmentSelectionCleared] = useState(false);
  const [editing, setEditing] = useState<{ id: OptionId; revision: number } | null>(null);
  const [treatmentEditState, setTreatmentEdit] = useState<TreatmentEdit | null>(null);
  const [treatmentFormDirty,setTreatmentFormDirty]=useState(false);
  const [notice, setNoticeText] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "info" | "warning">("info");
  const [noticeSequence, setNoticeSequence] = useState(0);
  const setNotice = (message: string, kind: "success" | "info" | "warning" = "info") => { setNoticeKind(kind); setNoticeText(message); setNoticeSequence(sequence => sequence + 1); };
  const showReadinessNotice = (issues: readonly ReadinessIssue[]) => {
    if (!issues.length) return;
    const needsToast = issues.some(issue => !readinessFieldSelector(issue));
    if (needsToast) setNotice(issues.length === 1 ? issues[0]!.message : `${issues.length} hal perlu diperiksa.`, "warning");
  };
  const [blockedTarget, setBlockedTarget] = useState<Route | null>(null);
  const [focusIssue, setFocusIssue] = useState<(ReadinessIssue & Partial<FieldDecisionAction>) | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [formProblem, setFormProblem] = useState<{ element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; issue: ReadinessIssue } | null>(null);
  const nativeProblemElement = formProblem?.element;
  useEffect(() => { if (nativeProblemElement) { nativeProblemElement.scrollIntoView({ block: "center" }); nativeProblemElement.focus({ preventScroll: true }); } }, [nativeProblemElement]);
  const [guided, setGuided] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const studioInspector = useRef<StudioInspectorHandle>(null);
  useEffect(() => {
    if (!notice) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog:modal')) { setNoticeText(''); if (document.activeElement?.closest('.notice')) heading.current?.focus({ preventScroll: true }); }
    };
    const timer = window.setTimeout(() => { if (document.activeElement?.closest('.notice')) heading.current?.focus({ preventScroll: true }); setNoticeText(''); }, 2000);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', dismiss);
    };
  }, [notice, noticeSequence]);
  useEffect(() => {
    document.title = `TIRTA — ${navigatorOpen ? 'Navigator' : assistantOpen ? 'Tanya TIRTA' : routes.find((r) => r.id === route)?.label}`;
  }, [route, assistantOpen, navigatorOpen]);
  const closeNavigator=(after?:()=>void)=>{
    if(!navigatorOpen||navigatorClosing){after?.();return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setNavigatorOpen(false);after?.();return;}
    setNavigatorClosing(true);
    if(navigatorCloseTimer.current!==null)window.clearTimeout(navigatorCloseTimer.current);
    navigatorCloseTimer.current=window.setTimeout(()=>{setNavigatorOpen(false);setNavigatorClosing(false);after?.();},175);
  };
  const openNavigator=()=>{
    if(navigatorCloseTimer.current!==null){window.clearTimeout(navigatorCloseTimer.current);navigatorCloseTimer.current=null;}
    setNavigatorClosing(false);
    setNavigatorOpen(true);
  };
  useEffect(()=>()=>{if(navigatorCloseTimer.current!==null)window.clearTimeout(navigatorCloseTimer.current);},[]);
  const [rainDrafts, setRainDrafts] = useState<Record<string, RainEditorDraft>>({});
  const { project, scenario, draft, chosen, limits } = state;
  const motionState = useRef({ route, scenario });
  const motionFrame = useRef<number | null>(null);
  const motionTimer = useRef<number | null>(null);
  useLayoutEffect(() => {
    const previous = motionState.current;
    motionState.current = { route, scenario };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const routeChanged = previous.route !== route;
    const scenarioChanged = previous.scenario !== scenario;
    if (!routeChanged && !scenarioChanged) return;
    workspace.classList.remove('tirta-motion-enter','tirta-motion-data');
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    const className = routeChanged ? 'tirta-motion-enter' : 'tirta-motion-data';
    motionFrame.current = requestAnimationFrame(() => {
      workspace.classList.add(className);
      motionTimer.current = window.setTimeout(() => workspace.classList.remove(className), routeChanged ? 300 : 260);
    });
  }, [route, scenario]);
  const navigator=useTirtaNavigator(project,scenario,store.active);
  const treatmentEdit = treatmentEditState?.project.id === project.id && treatmentEditState.scenarioId === scenario ? treatmentEditState : null;
  const delegatedTaskRoot=navigator.journey.currentTaskId?.split(':').slice(0,4).join(':')??null;
  const nextTaskRoot=navigator.task?.id.split(':').slice(0,4).join(':')??null;
  const delegatedContextFinished=!!navigator.journey.currentTaskId&&(!navigator.task||delegatedTaskRoot!==nextTaskRoot||navigator.task.returnDestination!==navigator.journey.returnDestination);
  const delegatedTaskComplete = !!navigator.journey.returnDestination && route === navigator.journey.returnDestination && delegatedContextFinished && !navigatorOpen && !assistantOpen && !reportOpen && !treatmentFormDirty && !(treatmentEdit && planningFingerprint(treatmentEdit.project)!==planningFingerprint(project));
  const reopenNavigator = useEffectEvent(() => {
    setNoticeText('');
    setAssistantOpen(false);
    openNavigator();
    navigator.returned();
    history.replaceState(null,'','?view=navigator');
  });
  useEffect(() => {
    if (!delegatedTaskComplete) return;
    const timer=window.setTimeout(()=>reopenNavigator(),180);
    return ()=>window.clearTimeout(timer);
  },[delegatedTaskComplete]);
  const parcelArea = project.parcel
    ? project.parameters.find((p) => p.id === project.parcel!.area.id)?.value ?? null
    : null;
  const zoneAreaTotal = project.zones.reduce(
    (sum, z) => sum + (project.parameters.find((p) => p.id === z.area.id)?.value ?? 0),
    0,
  );
  const comparisonRainScenarios = project.scenarios.filter(s => readInput(project, s.rainfall, s.id).text !== "");
  const comparisonRainReady = comparisonRainScenarios.some(s=>s.id===scenario);
  const currentScenario = project.scenarios.find((s) => s.id === scenario);
  const rain = currentScenario
    ? project.parameters.find((p) => p.id === currentScenario.rainfall.id)
    : undefined;
  const zone =
    project.zones.find((z) => z.id === selected) ?? null;
  const coefficient = zone
    ? project.parameters.find((p) => p.id === zone.coefficient.id) ?? null
    : null;
  const baseline = evaluate(project, scenario, []);
  const draftResult = evaluate(project, scenario, draft);
  const eventBalance = evaluateEventPlan(project, snapshotPlan(project, draft, 'event-preview', 'Pratinjau air'), scenario);
  const eventResult = eventBalance.ok && baseline ? { baseline: baseline.baseline, retained: eventBalance.value.stored, reused: eventBalance.value.reused, infiltrated: eventBalance.value.infiltrated, residual: eventBalance.value.residual } : null;
  const search = useMemo(() => alternativeSearch(project, scenario), [project, scenario]);
  const rows = useMemo(() => search.rows.filter(row => row.plan.components.some(component => component.enabled)), [search.rows]);
  const runoffHighlightIds = useMemo(() => runoffHighlights(rows), [rows]);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [searchDetailsOpen, setSearchDetailsOpen] = useState(false);
  const readiness = useMemo(() => workflowReadiness(store.active ? project : null, scenario, search), [store.active, project, scenario, search]);
  const productView = useMemo(() => productState(store.active ? project : null, scenario,treatmentEdit?.id), [store.active, project, scenario,treatmentEdit?.id]);
  const fieldState = productView.decision;
  const blockedIssues = blockedTarget ? readiness[blockedTarget] : [];
  const currentIssues = readiness[completionGate[route]];
  const coverageIssue = readiness.rain.find(i => i.field === "coverage");
  const zoneIssues = blockedIssues.filter(i => i.zoneId === zone?.id);
  const revealIssue = (issue: ReadinessIssue & Partial<FieldDecisionAction>) => {
    if (issue.scenarioId && issue.scenarioId !== scenario) store.update({scenario:issue.scenarioId});
    setRoute(issue.stage); history.replaceState(null, "", `?view=${issue.stage}`);
    if (issue.zoneId) setSelected(issue.zoneId);
    if (issue.componentId) { setTreatmentFormDirty(false);setTreatmentEdit(editTreatment(project,issue.componentId,issue.scenarioId ?? scenario)); setTreatmentSelectionCleared(false); setActiveIntervention(issue.componentId); setEditing(null); }
    setFocusIssue({ ...issue,label:issue.componentId?productView.treatments.find(c=>c.id===issue.componentId)?.sections.flatMap(s=>s.rows).find(r=>r.field===issue.field)?.label:issue.label });
  };
  const inspectReadiness = (target: Route = completionGate[route]) => {
    setBlockedTarget(target); setGuideOpen(true); setFormProblem(null);
    if (readiness[target][0]) revealIssue(readiness[target][0]);
  };
  useEffect(() => {
    if (!focusIssue) return;
    if (focusIssue.zoneId&&!focusIssue.field.startsWith('roof')) studioInspector.current?.reveal();
    const frame = requestAnimationFrame(() => {
      const focus = (selector: string) => {const element=document.querySelector<HTMLElement>(selector); if(!element)return;for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;element.scrollIntoView({block:'nearest'});element.focus({preventScroll:true});};
      if(focusIssue.field.startsWith('roof')){focus('.roof-context-tool');return;}
      if(focusIssue.section === 'constraints' || ['budget','land','constraints'].includes(focusIssue.field)) {
        document.querySelector<HTMLButtonElement>('.intervention-limit-summary header button')?.click();
        requestAnimationFrame(()=>focus(readinessFieldSelector({...focusIssue,componentId:undefined})??'.constraint-editor [name="budget"]'));return;
      }
      if(focusIssue.componentId && document.querySelector('.guided-composer')) {
        window.dispatchEvent(new CustomEvent('tirta-treatment-focus',{detail:{componentId:focusIssue.componentId,field:focusIssue.field}}));
        return;
      }
      if(focusIssue.stage==='studio' && !focusIssue.zoneId && ['geometry','zones','dimensions','coverage'].includes(focusIssue.field)){focus('.simple-area-trigger');return;}
      if(focusIssue.componentId) {
        const index=focusIssue.section==='resources'?3:focusIssue.section==='capacity'?2:1;
        document.querySelector<HTMLButtonElement>(`.treatment-stages button:nth-child(${index})`)?.click();
        if(focusIssue.section==='site' || (focusIssue.section==='capacity' && ['capacityBasis','performanceMethod','performanceContext','nominal'].includes(focusIssue.field)) || !focusIssue.section) {
          document.querySelector<HTMLButtonElement>('.composer-details .option-config-trigger')?.click();
          requestAnimationFrame(()=>{document.querySelector<HTMLButtonElement>(`.scientific-task-switch button:nth-child(${focusIssue.section==='site'?2:1})`)?.click();requestAnimationFrame(()=>focus(focusIssue.field==='groundwater'?'.intervention-review [name=groundwaterAssessment]':'.intervention-review form [aria-invalid="true"], .intervention-review form [data-section]:not([hidden]) input:not(:disabled), .intervention-review form [data-section]:not([hidden]) select:not(:disabled)'));});
        } else if(focusIssue.section==='connection') requestAnimationFrame(()=>{
          const composer=document.querySelector('.treatment-composer');
          const sourceMissing=!composer?.querySelector('.treatment-source-chips > span');
          const via=composer?.querySelector<HTMLSelectElement>('[name=via]');
          const selector=focusIssue.field==='installation'?'.treatment-composer [data-role-choice=installation]'
            :focusIssue.field==='source'?'.treatment-composer [data-role-choice=source]'
            :focusIssue.field==='catchmentReviewed'?'.treatment-composer [name=catchmentReviewed]'
            :focusIssue.field==='via'?'.treatment-composer [name=via]'
            :focusIssue.field==='sharedSourceMode'?'.treatment-composer .shared-source-warning select'
            :focusIssue.field==='allocationNote'?'.treatment-composer [name=allocationNote]'
            :sourceMissing?'.treatment-composer [data-role-choice=source]'
            :via?.value==='unknown'?'.treatment-composer [name=via]'
            :'.treatment-composer .shared-source-warning select';
          focus(selector);
          if(selector.includes('data-role-choice'))document.querySelector<HTMLButtonElement>(selector)?.click();
        });
        else requestAnimationFrame(()=>focus(focusIssue.section==='resources'?`.treatment-composer [name="${focusIssue.field==='cost'?'cost':'area'}"]`:focusIssue.section==='capacity'?'.treatment-composer [name="capacity"]':'.treatment-composer [data-stage="0"] button'));
        return;
      }
      if(focusIssue.field==='coverage') {focus('.simple-area-trigger');return;}
      const selector = readinessFieldSelector(focusIssue);
      if(selector) {focus(selector);if(focusIssue.field==='coefficientSource')document.querySelector<HTMLButtonElement>(selector)?.click();}
      else heading.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusIssue]);
  const selectedDefinition = project.selectedPlan?.definition;
  const selectedPackage = selectedDefinition ? {
    id: selectedDefinition.id, name: selectedDefinition.name,
    optionIds: selectedDefinition.components.filter(c => c.enabled).map(c => c.id as OptionId),
  } : null;
  const selectedProject = selectedDefinition ? { ...project, components: selectedDefinition.components, parameters: [...project.parameters.filter(p => !selectedDefinition.parameters.some(saved => saved.id === p.id)), ...selectedDefinition.parameters] } : project;
  const decisionStale = !!project.selectedPlan && project.selectedPlan.reviewedInputFingerprint !== planningFingerprint(project);
  const frozenResult = selectedDefinition ? evaluatePlan(project, selectedDefinition, scenario) : null;
  const planResult = !decisionStale && frozenResult?.ok ? evaluationFromBalance(project, scenario, frozenResult.value) : null;
  const selectedChecks=selectedDefinition?planImplementationChecks(project,selectedDefinition,scenario):[];
  const impactInterpretation = planResult
    ? decisionInterpretation(planResult.baseline.runoffM3, planResult.residual)
    : null;
  const impactVerification = selectedPackage
    ? decisionVerificationItems(selectedProject, scenario, selectedPackage.optionIds)
    : [];
  const impactPhotoProvenance = decisionPhotoProvenance({ ...selectedProject, imageObservations: project.imageObservations });
  const update = (change: Partial<Snapshot>) => {
    try { store.update(change); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Perubahan belum tersimpan."); }
  };
  const go = (requested: Route) => {
    const next = requested === "compare" ? "alternatives" : requested;
    const hasUnsavedTreatment = route === "interventions" && next !== "interventions" && (treatmentFormDirty || !!treatmentEdit && planningFingerprint(treatmentEdit.project) !== planningFingerprint(project));
    if (hasUnsavedTreatment) {
      setNotice("Simpan penanganan atau Batal dulu agar isian yang baru tidak hilang.", "info");
      return;
    }
    setNavigatorOpen(false);
    if (["alternatives", "compare"].includes(next) && !comparisonRainReady) {
      setAssistantOpen(false); setBlockedTarget(null); setGuideOpen(false);
      setRoute("rain"); history.pushState(null, "", "?view=rain");
      setNotice("Isi hujan aktif sebelum membandingkan paket.", "warning");
      return;
    }
    setAssistantOpen(false);
    const issues = next === "impact" || next === "alternatives" ? [] : forwardIssues(route, next, readiness);
    if (issues.length) {
      setBlockedTarget(next); setGuideOpen(issues.length > 1); revealIssue(issues[0]!);
      if (next === "impact" && project.selectedPlan) setNotice("Data berubah atau rencana belum memenuhi syarat saat ini. Pilihan lama tetap tersimpan; tinjau alternatif lalu pilih kembali.", "warning");
      else if (issues.length === 1) showReadinessNotice(issues);
      return;
    }
    setBlockedTarget(null); setFocusIssue(null); setGuideOpen(false); setFormProblem(null);
    if (noticeKind === "warning") setNoticeText('');
    setPlacing(null); setEditing(null); setRoleSelection(null); setContextSource(null);
    setRoute(next);
    history.pushState(null, "", `?view=${next}`);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => heading.current?.focus());
  };
  useEffect(() => {
    const restoreRoute = () => {
      if(new URLSearchParams(location.search).get('view')==='navigator'){openNavigator();setAssistantOpen(false);return;}
      setNavigatorOpen(false);
      if (new URLSearchParams(location.search).get('view') === 'assistant') { setAssistantOpen(true); return; }
      setAssistantOpen(false);
      const next = routeFromUrl();
      const issues = next === "impact" || next === "alternatives" ? [] : forwardIssues(route, next, readiness);
      if (issues.length) { setBlockedTarget(next); revealIssue(issues[0]!); if (issues.length === 1) showReadinessNotice(issues); }
      else { setPlacing(null); setEditing(null); setRoute(next); setBlockedTarget(null); }
    };
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  });
  const loadDemo = async (complete: boolean, uncertainty = false) => {
    try {
      await store.create("Contoh TIRTA", setActiveComponents(currentDemoProject(complete, uncertainty), ["tank","soak","garden"]));
      setSelected(complete ? "z0" : "z2"); setRoute("studio");
      setNotice("Contoh sintetis dibuka secara terpisah dari proyek riil.");
    } catch (cause) { setNotice(String(cause)); }
  };
  const loadBlank = async () => {
    if (!projectName.trim()) { setNotice("Isi nama proyek terlebih dahulu."); return; }
    try {
      await store.create(projectName); setSelected(""); setOverlay(false); setNavigatorOpen(false); setAssistantOpen(false); setRoute("studio"); history.pushState(null,'','?view=studio');
      setNoticeText("");
    } catch (cause) { setNotice(String(cause)); }
  };
  const addHandling = (family: Parameters<typeof addTreatment>[1], sourceId?: string, biopori = false) => {
    if (!currentScenario) {
      setRoute("rain");
      setNotice("Tambahkan skenario hujan sebelum membuat penanganan.");
      return;
    }
    const next = exploreTreatment(project, family, scenario, sourceId, biopori);
    setTreatmentEdit(next); setTreatmentSelectionCleared(false); setActiveIntervention(next.id); setEditing(null); setPlacing(null); setRoleSelection(null);
    requestAnimationFrame(() => { const editor = document.querySelector<HTMLElement>('.active-intervention-editor'); editor?.querySelector<HTMLButtonElement>('.role-choice')?.focus({ preventScroll: true }); });
  };
  const toggle = (id: OptionId) => {
    setRoleSelection(null); setTreatmentEdit(null);
    const nextDraft = draft.includes(id)
      ? draft.filter((d) => d !== id)
      : [...draft, id];
    const nextProject = setActiveComponents(project, nextDraft);
    const affected = invalidatedDestinationLabels(project, nextProject);
    try {
      store.update({ draft: nextDraft, project: nextProject, chosen: null });
      if (affected.length) setNotice(`Tujuan air untuk ${affected.join(', ')} sekarang belum ditentukan karena penanganan tujuan dilepas. Pilih tujuan baru.`, 'warning');
    } catch (cause) { setNotice(planningError(cause), 'warning'); }
  };
  const editIntervention = (id: OptionId) => { setTreatmentFormDirty(false);setTreatmentEdit(editTreatment(project,id,scenario)); setTreatmentSelectionCleared(false); setRoleSelection(null); setPlacing(null); setEditing(previous => ({ id, revision: (previous?.revision ?? 0) + 1 })); };
  const followGuidance = useEffectEvent((event:Event)=>{
      const d=(event as CustomEvent<{field?:string;method?:string;sourceId?:string;installationZoneId?:string;componentId?:string}>).detail;
      if(!d || typeof d.field!=='string')return;
      if(d.sourceId&&project.zones.some(z=>z.id===d.sourceId))setSelected(d.sourceId);
      const methods={storage:'storage',infiltration:'infiltration',biopori:'infiltration','rain-garden':'rain-garden',permeable:'permeable'} as const;
      const method=d.method as keyof typeof methods;
      const matches=(c:typeof project.components[number])=>c.family===methods[method] && (c.family!=='infiltration'||(c.infiltrationType==='biopori')===(method==='biopori'));
      const c=project.components.find(c=>c.id===d.componentId&&matches(c))??project.components.find(c=>c.enabled&&matches(c));
      if(c){setTreatmentFormDirty(false);setTreatmentEdit(editTreatment(project,c.id,scenario));setActiveIntervention(c.id);setEditing(null);setTreatmentSelectionCleared(false);}
      else if(currentScenario&&methods[method]&&project.parcel&&project.zones.length&&['capacity','soil','groundwater','installation','connection','resources'].includes(d.field)){
        const next=exploreTreatment(project,methods[method],scenario,d.sourceId,method==='biopori');
        const receiver=project.zones.find(z=>z.id===d.installationZoneId&&(method!=='biopori'||bioporiInstallationAllowed(z.surface)));
        if(receiver)next.project.components.find(c=>c.id===next.id)!.treatment!.installationZoneId=receiver.id;
        setTreatmentEdit(next);setActiveIntervention(next.id);setEditing(null);setTreatmentSelectionCleared(false);setRoleSelection(null);setPlacing(null);
      }
      setGuidanceFocus({field:d.field});
  });
  useEffect(()=>{
    const follow=(event:Event)=>followGuidance(event);
    window.addEventListener('tirta-guidance-action',follow);
    return()=>window.removeEventListener('tirta-guidance-action',follow);
  },[]);
  useEffect(()=>{
    if(!guidanceFocus||assistantOpen)return;
    const frame=requestAnimationFrame(()=>{
      if(route==='interventions'){
        const stage=guidanceFocus.field==='capacity'?1:guidanceFocus.field==='resources'?2:0;
        document.querySelector<HTMLButtonElement>(`.treatment-stages button:nth-child(${stage+1})`)?.click();
        if(['soil','groundwater','maintenance'].includes(guidanceFocus.field))document.querySelector<HTMLButtonElement>('.composer-details .option-config-trigger')?.click();
      }else if(route==='studio')studioInspector.current?.reveal();
      setGuidanceFocus(null);
    });
    return()=>cancelAnimationFrame(frame);
  },[guidanceFocus,assistantOpen,route]);
  const beginPlacement = (id: OptionId) => {
    setPlacing(id);
  };
  const placeIntervention = (id: OptionId, point: Point) => {
    if (!project.parcel || !containsPoint(project.parcel.polygon, point)) { setNotice("Letakkan simbol di dalam batas persil. Posisi sebelumnya dipertahankan."); return; }
    // Generic palette is click/touch/keyboard only; creation by drop is not accepted.
    if (id.startsWith('new:')) return;
    const component = project.components.find(c => c.id === id);
    if (!component) return;
    const issue = treatmentPlacementIssue(project, component, point);
    if (issue) { setNotice(issue); return; }
    const p = structuredClone(project);
    const c = p.components.find(c => c.id === id)!;
    c.placement = { point, footprint: null, context: "schematic" }; c.revision++;
    try { store.update({ project: p }); setPlacing(null); setTreatmentSelectionCleared(false); setActiveIntervention(id); setEditing(null); } catch (cause) { setNotice(String(cause)); }
  };
  const applyZoneData = ({
    surface,
    areaRaw,
    coefficientRaw,
    coefficientSource,
    nameRaw,
    surfaceContext,
    poreType,
  }: {
    surface?: Surface | null;
    areaRaw?: string;
    coefficientRaw?: string;
    coefficientSource?: string;
    nameRaw?: string;
    surfaceContext?: string;
    poreType?: "unknown" | "natural" | "manufactured";
  }) => {
    const target = zone;
    if (!target) return false;
    const areaParameter = project.parameters.find((p) => p.id === target.area.id);
    const coefficientParameter = project.parameters.find(
      (p) => p.id === target.coefficient.id,
    );
    const areaParsed =
      areaRaw === undefined ? null : numericInput(areaRaw);
    const coefficientParsed =
      coefficientRaw === undefined ? null : numericInput(coefficientRaw);
    if (areaParsed && !areaParsed.ok) {
      setNotice(areaParsed.issues[0]?.message ?? "Luas belum dapat diterapkan.");
      return false;
    }
    if (coefficientParsed && !coefficientParsed.ok) {
      setNotice(
        coefficientParsed.issues[0]?.message ??
          "Koefisien belum dapat diterapkan.",
      );
      return false;
    }
    if (
      coefficientParsed?.ok &&
      coefficientParsed.value !== null &&
      coefficientParsed.value > 1
    ) {
      setNotice("Koefisien harus antara 0 dan 1.");
      return false;
    }
    const valueInput = (
      current: typeof areaParameter,
      value: number | null,
      changed: boolean,
      sourceText: string,
    ) => ({
      value,
      evidence:
        value === null
          ? ("UNKNOWN" as const)
          : changed
            ? ("USER_INPUT" as const)
            : (current?.evidence ?? ("USER_INPUT" as const)),
      source:
        value === null
          ? ""
          : changed
            ? sourceText
            : (current?.source ?? sourceText),
      note: current?.note ?? "",
    });
    try {
      const areaMethod=target.areaMethod;
      const nextProject = updateShapeData(
        project,
        target.id,
        {
          name: nameRaw?.trim() || target.name,
          surface: surface === undefined ? target.surface : surface,
          area: valueInput(
            areaParameter,
            areaParsed?.ok ? areaParsed.value : (areaParameter?.value ?? null),
            areaRaw !== undefined,
            "Luas zona dinyatakan pengguna pada Studio Persil.",
          ),
          coefficient: valueInput(
            coefficientParameter,
            coefficientParsed?.ok
              ? coefficientParsed.value
              : (coefficientParameter?.value ?? null),
            coefficientRaw !== undefined,
            coefficientSource ?? coefficientParameter?.source ?? "",
          ),
          method: areaRaw === undefined ? target.areaMethod.kind : "direct",
          length: areaMethod.kind === 'measured-rectangle' ? project.parameters.find(p=>p.id===areaMethod.length.id)! : {value:null,evidence:'UNKNOWN',source:'',note:''},
          width: areaMethod.kind === 'measured-rectangle' ? project.parameters.find(p=>p.id===areaMethod.width.id)! : {value:null,evidence:'UNKNOWN',source:'',note:''},
        },
        () => crypto.randomUUID(),
      );
      if (surfaceContext !== undefined) nextProject.zones.find(z => z.id === target.id)!.surfaceContext = surfaceContext;
      if (poreType !== undefined) nextProject.zones.find(z => z.id === target.id)!.poreType = poreType;
      update({ project: nextProject });
      setNotice("Data area diterapkan.", "success");
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Data zona belum dapat diterapkan.",
      );
      return false;
    }
  };
  const applyRainData = ({
    rainRaw,
    sourceText,
    rainBasis,
    scenarioName,
  }: {
    rainRaw?: string;
    sourceText?: string;
    rainBasis?: "assumption" | "reference";
    scenarioName?: string;
  }) => {
    const parsed = rainRaw === undefined ? null : numericInput(rainRaw);
    if (parsed && !parsed.ok) {
      setNotice(parsed.issues[0]?.message ?? "Hujan belum dapat diterapkan.");
      return false;
    }
    if (!rain || !currentScenario) {
      setNotice("Tambahkan skenario hujan terlebih dahulu.");
      return false;
    }
    const value = parsed?.ok ? parsed.value : rain.value;
    const rawSource = sourceText === undefined ? rain.source : sourceText.trim();
    const assumptionPrefix = rainAssumptionSource;
    const nextSource = rainBasis === "assumption"
      ? `${assumptionPrefix}${rawSource ? ` ${rawSource}` : ""}`
      : rawSource;
    if (rainBasis === "reference" && !nextSource.trim()) {
      setNotice("Isi sumber data hujan, atau pilih Skenario uji saya.");
      return false;
    }
    try {
      const nextProject = saveRain(
        project,
        currentScenario.id,
        scenarioName?.trim() || currentScenario.name,
        {
          text: value === null ? "" : String(value),
          evidence: value === null ? "UNKNOWN" : rainBasis === "assumption" ? "ASSUMPTION" : "USER_INPUT",
          source: value === null ? "" : nextSource.trim(),
        },
        currentScenario.eventWindowNote,
      );
      update({ project: nextProject });
      setNotice("Skenario hujan diterapkan dan hasil dihitung ulang.", "success");
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Skenario hujan belum dapat diterapkan.",
      );
      return false;
    }
  };
  const removeRainScenario = (id: string) => {
    const target = project.scenarios.find(item => item.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus ${target.name}? Data kinerja intervensi yang khusus untuk skenario ini juga akan dilepas.`)) return;
    try {
      const next = deleteRainScenario(project, id);
      const nextScenario = next.scenarios[0]?.id ?? "";
      if (nextScenario) store.update({ project: next, scenario: nextScenario });
      else store.update({ project: next });
      setRainDrafts({});
      setNotice(`${target.name} dihapus.`, "success");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Skenario belum dapat dihapus.", "warning"); }
  };
  const selectPlan = (id: string) => {
    const row = rows.find(row => row.id === id);
    if (!row?.result?.feasible) return;
    const resourceStatus = resourceLimitStatus({ cost: row.result.cost, area: row.result.area }, limits);
    if (!resourceStatus.withinKnownLimits) { setNotice("Paket melampaui batas biaya atau lahan. Ubah batas atau pilih paket lain.", "warning"); return; }
    update({ project: { ...project, selectedPlan: { definition: row.plan, decisionNote: "", reviewedInputFingerprint: planningFingerprint(project) } } });
    setNotice(`Rencana dipilih: ${row.name}.`, "success");
    // This event just committed the valid snapshot; the render still contains the previous selection.
    setBlockedTarget(null); setFocusIssue(null); setRoute("impact"); history.pushState(null, "", "?view=impact");
    window.scrollTo(0, 0); requestAnimationFrame(() => heading.current?.focus());
  };
  const save = async () => {
    try { await store.save(); await store.refresh(); setNotice("Proyek tersimpan di browser ini.", "success"); }
    catch (cause) { setNotice(String(cause)); }
  };
  const restore = () => { void store.refresh().catch(e => setNotice(String(e))); setRoute("project"); };
  const openProject = async (id: string) => {
    try { await store.open(id); setSelected(""); setRoute("studio"); }
    catch (cause) { setNotice(String(cause)); }
  };
  const baselineCheck = productionBaseline(project, scenario);
  const missing = (title?: string) => {
    const issue = currentIssues[0];
    return <Missing title={title ?? issue?.message ?? (!baselineCheck.ok ? baselineCheck.issues[0]?.message : undefined) ?? "Periksa data rencana"}
      action="Tunjukkan bagian yang perlu dilengkapi"
      onAction={() => inspectReadiness()} />;
  };
  const title = routes.find((r) => r.id === route)!.label;
  const context = (
    <div className="parcel-context">
      <SquareDashed size={16} />
      <span>{project.name}</span>
      <span>{parcelArea === null ? "?" : fmt(parcelArea)} m²</span>
      <span>{project.zones.length} zona</span>
    </div>
  );
  const scenarioSwitch = (
    <div className="scenario-switch" aria-label="Skenario hujan">
      {project.scenarios.map((s) => {
        const depth = readInput(project, s.rainfall, s.id).text;
        const amount = depth === "" ? "?" : fmt(Number(depth));
        const caption = s.name.toLowerCase().endsWith(`${amount} mm`) ? s.name : `${s.name} · ${amount} mm`;
        return (
          <button
            key={s.id}
            aria-pressed={scenario === s.id}
            onClick={() => { setEditing(null); setPlacing(null); update({ scenario: s.id }); }}
          >
            <CloudRain size={15} />
            <span title={caption}>{caption}</span>
          </button>
        );
      })}
    </div>
  );
  const handleNavigatorTool=(fact:Parameters<typeof navigator.tool>[0])=>{
    const action=navigator.tool(fact);setNavigatorOpen(false);setAssistantOpen(false);setGuideOpen(false);
    if(fact.key==='options'&&navigator.journey.preferredFamily!=='undecided'){setRoute('interventions');history.replaceState(null,'','?view=interventions');const family=navigator.journey.preferredFamily;addHandling(family==='tank'?'storage':family==='garden'?'rain-garden':family==='permeable'?'permeable':'infiltration',undefined,family==='biopori');return;}
    revealIssue({...action,stage:action.destination,message:fact.why,section:action.section==='parcel'||action.section==='rainfall'||action.section==='selection'?undefined:action.section});
  };
  const navigatorView=<TirtaNavigator project={project} navigator={navigator} scenario={scenario} onProject={p=>{store.update({project:p});setNoticeText('');}} onNavigate={destination=>closeNavigator(()=>go(destination))} onTool={fact=>closeNavigator(()=>handleNavigatorTool(fact))}/>;
  return (
    <div className="direction-app bidang-air" onSubmit={() => { if (formProblem) setFormProblem(null); }} onInvalidCapture={e => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
      e.preventDefault();
      const label = input.getAttribute("aria-label") ?? input.labels?.[0]?.textContent?.trim() ?? "Kolom ini";
      const message = input.validity.valueMissing ? `${label} — isi terlebih dahulu.` : `${label} — periksa format atau batas angka yang ditampilkan.`;
      setFormProblem(current => current?.element.form === input.form && !current.element.validity.valid ? current : { element: input, issue: { stage: route, field: "form", message } });
    }}>
      <a className="skip-link" href="#workspace">
        Langsung ke ruang kerja
      </a>
      {reportOpen && <ProjectReportDialog project={project} scenario={scenario} onBackup={store.exportBackup} onClose={() => setReportOpen(false)}/>}

      <WorkbenchNavigation key={project.id} items={routes.map(({ id, label }) => {
        const details:Record<Route,{ready:boolean;message:string}>={
          project:{ready:!!store.active,message:store.active?'Proyek terbuka':'Buat atau buka proyek'},
          studio:{ready:!!store.active&&!readiness.rain.some(i=>i.stage==='studio'),message:readiness.rain.find(i=>i.stage==='studio')?.message??(!store.active?'Belum ada persil':'Luas, permukaan dan koefisien zona dinyatakan')},
          rain:{ready:fieldState.baseline.ready,message:fieldState.baseline.ready?'Hujan diterapkan; limpasan awal dapat dihitung':fieldState.baseline.actions[0]?.message??'Hujan belum diterapkan'},
          interventions:{ready:fieldState.treatments.some(c=>c.status!=='inactive'&&c.status!=='retired')&&fieldState.activePackage.comparisonReady,message:!fieldState.treatments.some(c=>c.status!=='inactive'&&c.status!=='retired')?'Belum ada penanganan disimpan':fieldState.activePackage.comparisonReady?'Penanganan siap dibandingkan':fieldState.activePackage.calculationReady?'Dampak dapat dihitung; biaya dan lahan perlu ditinjau':'Penanganan disimpan; dampak belum dapat dihitung'},
          alternatives:{ready:rows.length>0,message:rows.length?`${rows.length} alternatif dapat ditinjau; belum menjadi pilihan Anda`:'Belum ada paket yang dapat dibandingkan'},
          compare:{ready:rows.length>0,message:rows.length?'Pilih paket untuk membandingkan hasil pada beberapa hujan':'Belum ada paket yang dapat dibandingkan'},
          impact:{ready:fieldState.selected.ready,message:fieldState.selected.status==='none'?'Belum ada rencana pilihan':fieldState.selected.status==='stale'?'Data berubah; tinjau rencana pilihan kembali':fieldState.selected.ready?'Rencana pilihan memakai data terbaru':'Rencana tersimpan; hasil belum dapat dinilai'},
        };
        return {id,label,state:details[id].ready?'complete' as const:'partial' as const,explanation:details[id].message};
      })} current={route} helpTopic={route === "studio" ? "coefficient" : route === "rain" ? "rainfall" : route === "interventions" ? "interventions" : route === "project" ? "overview" : "alternatives"} name={project.name} projectId={project.id} status={store.status} editing={!!treatmentEdit?.fresh||treatmentFormDirty||!!treatmentEdit&&planningFingerprint(treatmentEdit.project)!==planningFingerprint(project)} guided={guided} onNavigate={go} onSave={save} onReport={store.active ? () => setReportOpen(true) : undefined} onOpen={() => { setNavigatorOpen(false);setAssistantOpen(false); restore(); history.pushState(null, '', '?view=project'); }} onGuidance={() => setGuided(value => !value)} navigatorOpen={navigatorOpen} onNavigator={()=>{if(treatmentFormDirty||treatmentEdit&&planningFingerprint(treatmentEdit.project)!==planningFingerprint(project)){setNotice('Simpan penanganan atau batalkan isian sebelum membuka Navigator.','warning');return;}if(!store.active){setNotice('Buat atau buka proyek terlebih dahulu.');return;}setNoticeText('');setAssistantOpen(false);openNavigator();history.pushState(null,'','?view=navigator');window.scrollTo(0,0);}} assistantOpen={assistantOpen} onAssistant={() => { setNavigatorOpen(false); setRecommendationRequested(false); setAssistantOpen(true); history.pushState(null, '', '?view=assistant'); window.scrollTo(0, 0); }} />

      <div className="app-body">

      {notice && (!navigatorOpen||noticeKind==="warning") && (
        <div className={`notice notice-${noticeKind} ${navigatorOpen?"navigator-notice":""}`} role="status">
          {noticeKind === "warning" ? <ClipboardList size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
          <span>{notice}</span>
          {noticeKind === "warning" && <button className="notice-reveal" onClick={() => { setNoticeText(''); inspectReadiness(blockedTarget ?? completionGate[route]); }}>Tunjukkan<ArrowRight size={16} aria-hidden="true" /></button>}
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => { setNoticeText(''); if (document.activeElement?.closest('.notice')) heading.current?.focus({ preventScroll: true }); }}
          >
            <X size={16} />
          </button>
        </div>
      )}
        <div className="mobile-route" role="navigation" aria-label="Pilihan ruang kerja">
          <label htmlFor="workspace-select">Ruang kerja</label>
          <select
            id="workspace-select"
            value={route}
            onChange={(e) => go(e.target.value as Route)}
          >
            {routes.map((r) => (
              <option value={r.id} key={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <main id="workspace" className={`workspace view-${assistantOpen ? 'assistant' : route}`}>
          {store.error && <p className="storage-error" role="alert">{store.error} · Simpanan tidak ditimpa. <button disabled={!store.active} onClick={() => void store.rescueCopy().then(() => setNotice("Perubahan disimpan sebagai proyek pemulihan terpisah.")).catch(e => setNotice(String(e)))}>Simpan perubahan sebagai salinan</button></p>}
          {assistantOpen ? <PlanningAssistant key={project.id} startRecommendation={recommendationRequested} originStep={route} selectedZoneId={selected} selectedInterventionId={editing?.id ?? (draft.includes(activeIntervention as OptionId) ? activeIntervention : draft[0] ?? null)} project={project} scenario={scenario} alternatives={rows.map(r => ({ plan: r.plan, balance: r.balance }))} onProject={p => store.update({ project: p })} onNavigate={go} /> : <>
          {formProblem && <ReadinessGuide issues={formProblem.element.validity.valid ? [] : [formProblem.issue]} active={formProblem.issue} anchor={formProblem.element} destination="perubahan ini" onSelect={() => { formProblem.element.scrollIntoView({ block: "center" }); formProblem.element.focus({ preventScroll: true }); }} onContinue={() => { const form = formProblem.element.form; setFormProblem(null); form?.requestSubmit(); }} onClose={() => setFormProblem(null)} />}
          {!formProblem && blockedTarget && guideOpen && <ReadinessGuide issues={blockedIssues} active={focusIssue} destination={routes.find(r => r.id === blockedTarget)!.label} onSelect={revealIssue} onContinue={() => go(blockedTarget)} onClose={() => { setGuideOpen(false); showReadinessNotice(blockedIssues); }} />}
          <div className="page-heading">
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {route === "impact" ? "Rencana pilihan Anda" : route === "interventions" ? "Rancang Penanganan" : title}
              </h1>
              {guided && (
                <p>
                  {
                    {
                      project:
                        "Buat proyek atau buka proyek tersimpan.",
                      studio:
                        "Masukkan ukuran area atau gambar zona, lalu pilih permukaannya.",
                      rain: "Masukkan hujan dan lihat limpasan tiap zona.",
                      interventions:
                        "Pilih sumber air, tentukan penanganan, lalu lengkapi dasar perhitungannya.",
                      alternatives:
                        "Bandingkan biaya, lahan, dan sisa limpasan.",
                      compare:
                        "Bandingkan hasil paket pada setiap skenario hujan.",
                      impact:
                        "Hasil rencana terpilih dan pemeriksaan sebelum pemasangan.",
                    }[route]
                  }
                </p>
              )}
            </div>
            {(route === "compare" || route === "alternatives") && <div className="compare-heading-scenarios"><span>Skenario hujan:</span>{scenarioSwitch}<HelpButton topic="rainfall" compact label="Dasar skenario hujan"/></div>}
            {route !== "project" && currentIssues.length > 0 && <button className="current-result readiness-trigger" aria-label={`Periksa kelengkapan: ${currentIssues.length} hal perlu diperiksa`} onClick={() => inspectReadiness()}>
              <ClipboardList size={17} aria-hidden="true" /><span>{currentIssues.length} perlu diperiksa</span><ArrowRight size={16} />
            </button>}
            {!navigatorOpen&&navigator.journey.returnDestination&&store.active&&<div className="navigator-return"><button onClick={()=>{if(treatmentFormDirty || treatmentEdit&&planningFingerprint(treatmentEdit.project)!==planningFingerprint(project)){setNotice('Simpan penanganan atau batalkan isian sebelum kembali.','warning');return;}setNoticeText('');openNavigator();setAssistantOpen(false);navigator.returned();history.pushState(null,'','?view=navigator');window.scrollTo(0,0);}}>Kembali ke Navigator<ArrowRight size={16}/></button></div>}
          </div>
          {guided && route !== "project" && <nav className="workflow-path" aria-label="Alur perencanaan">
            {([
              { id: "studio", title: "Persil", cue: "Isi data persil", icon: Map },
              { id: "rain", title: "Hujan", cue: "Hitung limpasan", icon: CloudRain },
              { id: "interventions", title: "Intervensi", cue: "Atur intervensi", icon: SlidersHorizontal },
              { id: "compare", title: "Bandingkan", cue: "Pilih rencana", icon: Scale },
            ] as const).map(({ id, title: stageTitle, cue, icon: Icon }, i) => {
              const current = id === route || (id === "compare" && (route === "alternatives" || route === "impact"));
              return <button key={id} aria-label={`Tahap ${stageTitle}`} aria-current={current ? "step" : undefined} onClick={() => go(id)}><Icon size={18} /><span><strong>{stageTitle}</strong><small>{cue}</small></span>{i < 3 && <ChevronRight className="workflow-arrow" size={16} aria-hidden="true" />}</button>;
            })}
          </nav>}
          {route === "project" && <ProjectLanding
            resume={store.resume&&<div className="landing-resume"><span>Proyek terakhir</span><strong title={store.resume.name}>{store.resume.name}</strong><p>{store.resume.next}</p><button className="primary" onClick={()=>void store.open(store.resume!.id).then(()=>{setNoticeText('');setNavigatorOpen(false);setAssistantOpen(false);setRoute('studio');history.pushState(null,'','?view=studio');window.scrollTo(0,0);}).catch(e=>setNotice(String(e),'warning'))}>Lanjutkan dari sini<ArrowRight size={18}/></button></div>}
            start={<form className="new-project-form" onSubmit={e => { e.preventDefault(); void loadBlank(); }}>
                    <label className="landing-name-field">Nama proyek<span className="landing-name-input"><FolderOpen size={20} aria-hidden="true"/><input value={projectName} onChange={e => setProjectName(e.target.value)} maxLength={120} required placeholder="Nama lahan atau bangunan" /></span></label>
                    <div className="orientation-actions"><button className="primary" type="submit">Buat proyek baru<ArrowRight size={18} /></button><button type="button" onClick={() => void loadDemo(true)}>Buka Contoh</button></div>
                  </form>}
            library={<LocalProjectList projects={store.projects} onOpen={id => void openProject(id)} onDelete={async (id, revision) => {
                    await store.remove(id, revision); setSelected(""); setPlacing(null); setEditing(null); setNotice("Proyek dihapus dari browser ini.", "success");
                  }} />}
            backup={<div className="project-backup landing-backup-actions">
                    <button className="backup-download" disabled={!store.active} title={store.active ? `Unduh cadangan ${project.name}` : "Buka atau buat proyek untuk mengunduh cadangannya"} onClick={() => void store.exportBackup().then(text => { const url = URL.createObjectURL(new Blob([text], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "TIRTA-proyek.tirta.json"; a.click(); URL.revokeObjectURL(url); }).catch(e => setNotice(String(e)))}><ArrowDownToLine size={19} aria-hidden="true"/><span>Unduh cadangan proyek</span></button>
                    <label className="backup-import" title="Buka salinan cadangan sebagai proyek terpisah"><FolderOpen size={19} aria-hidden="true"/><span>Buka cadangan</span><input className="sr-only" aria-label="Buka berkas cadangan" type="file" accept=".json,.tirta.json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void store.importBackup(file).then(warnings => { setRoute("studio"); setSelected(""); setNotice(warnings.join(" ") || "Cadangan dibuka sebagai proyek terpisah."); }).catch(e => setNotice(String(e))); }} /></label>
                  </div>}
            secondaryExample={<button className="text-button landing-secondary-example" type="button" onClick={() => void loadDemo(true, true)}>Contoh: data lapangan belum lengkap</button>}
            onNavigate={go}
          />}
          {route === "studio" && (
            <>
              <div className="studio-beginner-action"><SimpleAreaEntry project={project} onAdded={(p,id)=>{update({project:p});setSelected(id);setNotice('Area ditambahkan. Pilih patokan koefisien untuk menghitung limpasan.','success');requestAnimationFrame(()=>studioInspector.current?.reveal());}}/></div>
              <div className={`studio-layout ${zone ? "has-active-zone" : "no-active-zone"}`}>
                  <StudioInspector ref={studioInspector}>
              {zone && coefficient ? (
              <section
                className="property-bench"
                id="zone-properties"
                aria-label="Properti zona terpilih"
              >
                <div className="selected-object">
                  <span
                    className={`material-swatch ${zone.surface ?? ""}`}
                    style={{
                      backgroundColor: zone.surface ? materials[zone.surface].color : "#edf0ed",
                    }}
                  >
                    {project.zones.indexOf(zone) + 1}
                  </span>
                  <div className="selected-zone-copy">
                    <small>Zona terpilih</small>
                    {zoneRename?.id === zone.id ? <form className="zone-name-editor" onSubmit={event => {
                      event.preventDefault();
                      const value = zoneRename.value.trim();
                      if (!value) return;
                      if (applyZoneData({ nameRaw: value })) { setZoneRename(null); setNotice("Nama zona diperbarui.", "success"); }
                    }}>
                      <input
                        autoFocus
                        aria-label="Nama zona"
                        maxLength={100}
                        required
                        value={zoneRename.value}
                        onChange={event => setZoneRename({ id: zone.id, value: event.target.value })}
                        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setZoneRename(null); } }}
                      />
                      <button type="submit" className="zone-name-save" aria-label="Simpan nama zona"><Check size={15}/></button>
                      <button type="button" className="zone-name-cancel" aria-label="Batal ubah nama zona" onClick={() => setZoneRename(null)}><X size={15}/></button>
                    </form> : <div className="zone-name-row">
                      <h2>{zone.name}</h2>
                      <button type="button" className="zone-name-edit" aria-label={`Ubah nama zona ${zone.name}`} onClick={() => setZoneRename({ id: zone.id, value: zone.name })}><Pencil size={15}/></button>
                    </div>}
                    <span>{project.parameters.find(p => p.id === zone.area.id)?.value == null ? "?" : fmt(project.parameters.find(p => p.id === zone.area.id)!.value!)} m² · {zone.geometryContext === 'schematic-area' ? zone.areaMethod.kind==='measured-rectangle' ? 'panjang × lebar yang Anda masukkan' : 'luas yang Anda masukkan' : 'dari bentuk zona'}</span>
                  </div>
                </div>
                <label>
                  Jenis permukaan
                  <select
                    aria-label="Jenis permukaan"
                    aria-invalid={zoneIssues.some(i => i.field === "surface") || undefined}
                    aria-describedby={zoneIssues.some(i => i.field === "surface") ? "surface-error" : undefined}
                    value={zone.surface ?? ""}
                    onChange={(e) =>
                      applyZoneData({
                        surface: e.target.value
                          ? (e.target.value as Surface)
                          : null,
                      })
                    }
                  >
                    <option value="">Belum diklasifikasikan</option>
                    {Object.entries(surfaceLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                  {zoneIssues.some(i => i.field === "surface") && <small className="field-error" id="surface-error">Konfirmasi jenis permukaan zona ini.</small>}
                </label>
                {zone.geometryContext==='schematic-area'&&<SimpleAreaEntry project={project} editId={zone.id} onAdded={(p,id)=>{update({project:p});setSelected(id);setNotice('Ukuran area diterapkan.','success');}}/>}
                <ZoneDataFields missing={zoneIssues.some(i => i.field === "coefficient" || i.field === "coefficientSource")} key={`${zone.id}:${coefficient.revision}`} project={project} zone={zone} onApply={applyZoneData} />
                <FieldObservationControl project={project} zoneId={zone.id} onProject={p=>update({project:p})}/>
                <SurfaceScience project={project} zoneId={zone.id} onProject={p => update({ project: p })} />
              </section>
              ) : (
                <section
                  className="property-bench empty-zone-bench"
                  id="zone-properties"
                  aria-label="Properti zona"
                >
                  <div className="selected-object">
                    <span className="material-swatch">+</span>
                    <div>
                      <small>{project.zones.length ? "Tidak ada zona terpilih" : "Belum ada zona"}</small>
                      <h2>{project.zones.length ? "Pilih zona untuk melihat datanya" : "Tambahkan zona permukaan"}</h2>
                      <span>
                        {project.zones.length ? "Klik zona pada sketsa atau daftar di bawah untuk mengatur permukaan dan koefisiennya." : <>Masukkan luas lewat Tambah area sederhana, atau gambar batas dan zona menggunakan alat kanvas.</>}
                      </span>
                    </div>
                  </div>
                  <div className="reference-studio-help" aria-hidden="true"><strong>Informasi bantuan</strong><p>Pilih zona pada sketsa atau daftar untuk melihat detail datanya.</p></div>
                </section>
              )}
                </StudioInspector>
                <Parcel
                  key={project.id}
                  project={project}
                  selected={selected}
                  onSelect={setSelected}
                  onProject={(nextProject) => update({ project: nextProject })}
                  fit
                  roofGuided={navigator.journey.returnDestination==='studio'&&!!navigator.journey.currentTaskId?.includes(':roof')}
                  controls={<div className="studio-view-actions"><div className="segmented studio-layer-switch" aria-label="Tampilan sketsa">
                  <button
                    aria-pressed={!overlay}
                    onClick={() => setOverlay(false)}
                  >
                    <Layers3 size={16} />
                    Permukaan
                  </button>
                  <button
                    aria-pressed={overlay}
                    disabled={!baseline}
                    onClick={() => setOverlay(true)}
                  >
                    <Droplets size={16} />
                    Kontribusi hujan
                  </button>
                </div><div className="register-next">{<button className="primary" onClick={() => go("rain")}>{"Uji hujan pada persil ini"}<ArrowRight size={17}/></button>}</div></div>}
                  onInspect={() => studioInspector.current?.reveal()}
                  result={baseline}
                  analytical={overlay}
                  showGaps={!!coverageIssue && parcelArea !== null && zoneAreaTotal < parcelArea}
                />
                <ZoneNavigator project={project} selected={selected} onSelect={setSelected}>
                  <div className="register-total parcel-coverage" tabIndex={-1} aria-label="Cakupan zona pada persil">
                    <span>Cakupan zona</span>
                    <strong>{fmt(zoneAreaTotal)} / {parcelArea === null ? "?" : fmt(parcelArea)} m²</strong>
                    <div className="surface-composition" aria-hidden="true">
                      {project.zones.map((z) => (
                        <span
                          key={z.id}
                          style={{
                            flex:
                              project.parameters.find((p) => p.id === z.area.id)
                                ?.value ?? 0,
                            background: z.surface ? materials[z.surface].color : "#edf0ed",
                          }}
                        />
                      ))}
                      {parcelArea !== null && zoneAreaTotal < parcelArea && <span className="unmodelled-share" style={{flex: parcelArea - zoneAreaTotal}} />}
                    </div>
                    {coverageIssue && <small>{coverageIssue.message}</small>}

                    {readiness.rain.length > 1 && <button className="text-button" onClick={() => inspectReadiness("rain")}>Tunjukkan yang belum lengkap<ArrowRight size={15} /></button>}
                  </div>
                </ZoneNavigator>
              </div>
              <div className="screen-footer studio-next">
                <ProjectSources project={project} />

              </div>
              {overlay && baseline && <CalculationSource method="runoff" />}
            </>
          )}
          {route === "rain" && !rain && <section className="plan-empty"><h2>Belum ada skenario hujan</h2><p>Tambahkan kedalaman hujan yang ingin diuji. Angka contoh tetap ditandai sebagai skenario uji.</p><RainTemplates label="Tambah skenario hujan" project={project} onApply={(p, id) => store.update({ project: p, scenario: id })}/></section>}
          {route === "rain" && rain && <RainWorkspace project={project} result={baseline} selected={selected} onSelect={setSelected}
            editor={<><RainEditor scenarios={<div className="rain-scenario-picker"><span>Pilih skenario</span>{scenarioSwitch}<RainTemplates label="+ Skenario" project={project} onApply={(p, id) => store.update({ project: p, scenario: id })} />
                  <button type="button" className="text-button rain-delete-scenario" onClick={() => removeRainScenario(scenario)}>Hapus skenario aktif</button>
                  <details className="scenario-create"><summary>Tambah satu skenario kosong</summary><form onSubmit={e => {
                    e.preventDefault(); const f = new FormData(e.currentTarget); const id = crypto.randomUUID();
                    try { const p = saveRain(project, id, String(f.get("scenarioName") ?? ""), { text: "", evidence: "UNKNOWN", source: "" }, "Satu kejadian hujan sesuai isian pengguna."); update({ project: p, scenario: id }); }
                    catch (cause) { setNotice(String(cause)); }
                  }}><label>Nama skenario<input name="scenarioName" required maxLength={120} /></label><button type="submit">Buat skenario</button></form></details></div>} missing={blockedIssues.some(i => i.stage === "rain")}
                    key={`rain-editor-${project.id}-${rain.id}-${rain.revision}`}
                    remembered={rainDrafts[`${project.id}:${rain.id}:${rain.revision}`]}
                    onDraftChange={value => setRainDrafts(previous => {
                      const next = { ...previous };
                      const key = `${project.id}:${rain.id}:${rain.revision}`;
                      if (value) next[key] = value; else delete next[key];
                      return next;
                    })}
                    value={rain.value}
                    source={rain.source}
                    evidence={rain.evidence}
                    onApply={(rainRaw, sourceText, rainBasis) =>
                      applyRainData({ rainRaw, sourceText, rainBasis })
                    }
                  /><RainScience project={project} scenarioId={scenario} onProject={p => update({ project: p })}/></>}
            missing={missing()} sources={<ProjectSources project={project}/>} next={<button className="primary" onClick={() => go("interventions")}>{"Coba intervensi"}<ArrowRight size={17}/></button>}/>}
          {route === "interventions" && <>
            {contextSource && <ContextDialog title={`Tangani air dari ${project.zones.find(z => z.id === contextSource)?.name ?? "zona"}`} onClose={() => setContextSource(null)}><p>Pilih metode yang ingin dievaluasi. Kapasitas dan kesesuaian tetap perlu diperiksa.</p><div className="context-methods">{options.map(o => <button key={o.id} onClick={() => { addHandling(o.domainFamily, contextSource, o.biopori); setContextSource(null); }}><InterventionArt kind={o.id}/>{o.name}<ArrowRight size={17}/></button>)}</div></ContextDialog>}
            <div className="workspace-toolbar intervention-rain-toolbar">{context}<div className="intervention-rain-selection"><span>Uji pada hujan</span>{scenarioSwitch}<RainTemplates project={project} onApply={(p, id) => { store.update({ project: p, scenario: id }); setEditing(null); setPlacing(null); }}/></div></div>

            <InterventionWorkspace project={project} selected={selected} onSelect={id => { if (roleSelection) { if (!id) { setRoleSelection(null); setSelected(""); return; } if (roleSelection.soilOnly && roleSelection.role === "installation" && !bioporiInstallationAllowed(project.zones.find(z => z.id === id)?.surface ?? "roof")) { setNotice("Biopori tidak dapat dipasang pada Atap. Pilih lokasi non-atap; sumber air boleh berbeda."); return; } if (roleSelection.role === "conversion" && project.zones.find(z => z.id === id)?.surface !== "paved") { setNotice("Pilih zona Beton/Aspal untuk penggantian."); return; } roleSelection.onPick(id); setRoleSelection(null); } setSelected(id); }} enabled={draft} contextual={zone && !roleSelection && treatmentSelectionCleared ? <div className="selected-zone-action"><span>{zone.name} · {zone.surface ? surfaceLabels[zone.surface] : "Permukaan belum diketahui"}</span><button onClick={() => setContextSource(zone.id)}>Tangani air dari sini</button></div> : null} selectionCue={roleSelection && <div className="selection-role-cue" role="status"><strong>{roleSelection.role === "source" ? "Pilih sumber limpasan" : roleSelection.role === "installation" ? "Pilih lokasi penerapan" : "Pilih permukaan yang akan diubah"}</strong><button onClick={() => setRoleSelection(null)}>Batal memilih</button></div>}
              active={treatmentSelectionCleared ? "" : treatmentEdit?.id ?? editing?.id ?? (draft.includes(activeIntervention as OptionId) ? activeIntervention : draft[0] ?? "")}
              selectionCleared={treatmentSelectionCleared} placement={{ pending: placing, onPlace: placeIntervention, onEdit: editIntervention, onClear: () => { if (!roleSelection) { setTreatmentSelectionCleared(true); setSelected(""); } } }} cue={placing && <div className="placement-cue" role="status"><strong>{project.components.find(component => component.id === placing)?.name ?? options.find(o => o.id === placing)?.name}: klik posisi di persil</strong><span>Letak simbol saja; sumber air dipilih saat mengatur.</span><div><button onClick={() => project.parcel && placeIntervention(placing, visualLabelAnchor(project.parcel.polygon))}>Letakkan di tengah persil</button><button onClick={() => setPlacing(null)}>Batal</button></div></div>}
              palette={<div className="intervention-palette" aria-label="Pilihan keluarga intervensi">
                    {options.map(o => <button key={o.id} data-option={o.id} aria-label={`Tambahkan ${o.name}`} onClick={() => addHandling(o.domainFamily, undefined, o.biopori)}>
                      <InterventionArt kind={o.id} /><strong>{o.name}</strong>
                    </button>)}
                  </div>}
              navigator={<InterventionNavigator project={project} scenario={scenario} active={treatmentSelectionCleared ? "" : editing?.id ?? (draft.includes(activeIntervention as OptionId) ? activeIntervention : draft[0] ?? "")} onSelect={id => { setTreatmentFormDirty(false);setTreatmentEdit(editTreatment(project,id,scenario)); setRoleSelection(null); setTreatmentSelectionCleared(false); setActiveIntervention(id); setEditing(null); }} onEdit={id => { setTreatmentSelectionCleared(false); setActiveIntervention(id); editIntervention(id); }} onRemove={toggle} onDelete={id => { try { const next=deleteTreatment(project,id); const affected=invalidatedDestinationLabels(project,next); update({project:next}); setTreatmentEdit(null); setEditing(null); setTreatmentSelectionCleared(true); setNotice(`Penanganan dihapus.${affected.length ? " Tujuan air terkait perlu dipilih kembali." : ""}`, affected.length ? "warning" : "success"); } catch(cause) { setNotice(planningError(cause),"warning"); } }} onPlace={beginPlacement} onDuplicate={id => { try { const copy=duplicateTreatment(project,id,scenario); update({project:copy.project,draft:[...draft,copy.id],chosen:null}); setTreatmentEdit(editTreatment(copy.project,copy.id,scenario)); setTreatmentSelectionCleared(false); setActiveIntervention(copy.id); setEditing(null); setNotice("Salinan dibuat. Periksa sumber dan kapasitasnya."); } catch(cause) { setNotice(planningError(cause)); } }}/>}
              editor={(() => { const id = treatmentEdit?.id ?? editing?.id ?? (draft.includes(activeIntervention) ? activeIntervention : draft[0]); const working = treatmentEdit?.project ?? project; return id ? <TreatmentComposer key={`${project.id}:${id}:${scenario}:${working.components.find(c => c.id === id)?.family === "infiltration" ? (working.components.find(c => c.id === id) as { infiltrationType?: string })?.infiltrationType ?? "well" : ""}`} project={working} id={id} scenario={scenario} uncommitted={!!treatmentEdit?.fresh} onDirty={()=>setTreatmentFormDirty(true)} onCancel={() => { setTreatmentFormDirty(false);setTreatmentEdit(null); setEditing(null); setRoleSelection(null); setTreatmentSelectionCleared(true); }} onDraftProject={p => { setTreatmentEdit({... (treatmentEdit ?? editTreatment(project,id,scenario)),project:p}); }} onProject={p => { const next=treatmentEdit ? commitTreatmentEdit(project,treatmentEdit,p) : p; store.update({ project: next });navigator.focusTreatment(id);setTreatmentFormDirty(false); setTreatmentEdit(editTreatment(next,id,scenario)); setPlacing(null); }} onSaved={(name,deferred,affected=[]) => { if(deferred){navigator.clearTreatmentFocus();setTreatmentEdit(null);setEditing(null);setActiveIntervention("");setTreatmentSelectionCleared(true);} void store.save().then(() => setNotice((deferred ? `${name} disimpan untuk nanti.` : `${name} tersimpan.`) + (affected.length ? ` Tujuan air untuk ${affected.join(", ")} sekarang belum ditentukan. Pilih tujuan baru.` : ""), affected.length ? "warning" : "success")).catch(cause => setNotice(`Simpanan belum selesai. ${String(cause)}`, "warning")); }} onCanvas={(role, onPick, soilOnly) => { setRoleSelection({ role, onPick, soilOnly }); }}/> : null; })()}
              result={draftResult} eventResult={eventResult} limits={limits} constraints={<ConstraintEditor missing={blockedIssues.some(i => i.stage === "interventions" && !i.componentId)} key={project.id} project={project} onProject={p => { if(treatmentEdit) setTreatmentEdit(rebaseTreatmentEditLimits(project,treatmentEdit,p)); store.update({ project: p }); setPlacing(null); }}/>} support={<PlanningSupport packages={<PackageAdvisor project={project} scenario={scenario} search={search} onCompare={() => go("alternatives")} onPrepare={template => {
                    if (project.components.some(c => c.enabled) && !window.confirm(`Siapkan paket ${template.name}? Komposisi aktif akan diganti. Angka hanya dipertahankan jika jenis dan target sama; lainnya dikosongkan untuk menghindari asumsi keliru. Simpan varian dahulu jika ingin membandingkan konfigurasi lama.`)) return;
                    const p = prepareParcelPackage(project, template, scenario); update({ project: p }); setPlacing(null);
                    setNotice(`Paket ${template.name} disiapkan. Lengkapi angka di Intervensi Anda; belum ada kapasitas atau biaya dari sistem.`);
                  }} />} conditions={<ContextualAdvice project={project} scenario={scenario} onZone={id => { setSelected(id); go("studio"); }} onTry={(family, zoneId) => {
                    addHandling(family, zoneId);
                  }} />} variants={<VariantLibrary project={project} scenario={scenario} onProject={p => update({ project: p })} />} intent={<PlanningIntent project={project} onProject={p => update({ project: p })}/>} />}
              sources={<ProjectSources project={project}/>} next={<button className="primary" onClick={() => go("alternatives")}>{"Lihat alternatif"}<ArrowRight size={17}/></button>} onWaterMissing={() => { if (eventBalance.ok) return; const action=fieldState.activePackage.calculationActions[0]; if(action)revealIssue(action); else go("alternatives"); }} onMissing={() => go("alternatives")} nextAction={fieldState.activePackage.calculationActions[0]}/>
          </>}
          {route === "alternatives" && (comparisonRainReady ? <>
            {!rows.length && fieldState.treatments.filter(c=>c.status!=="inactive"&&c.status!=="retired"&&!c.comparisonReady).map(c=><section key={c.id} className="field-decision-readiness" aria-label={`${c.name} belum masuk perbandingan`}><h2>{c.name} belum masuk perbandingan</h2><p>{c.actions[0]?.message}</p>{c.actions[0]&&<button onClick={()=>revealIssue(c.actions[0]!)}>Lengkapi {c.name}<ArrowRight size={16}/></button>}</section>)}
            {search.issues.length > 0 && !rows.length && <div className="search-warning-summary" role="status"><span>Belum ada paket yang siap dibandingkan.</span><button className="text-button" onClick={() => setSearchDetailsOpen(true)}>Lihat alasan<ArrowRight size={16}/></button></div>}
            {!baseline ? missing() : !rows.length ? <><FieldDecisionReadiness state={fieldState} scope="active" onAction={a=>{setGuideOpen(false);revealIssue(a);}}/>
              {!project.optionGroups.some(g=>g.enabled)&&!project.manualPlans.length&&<div className="field-decision-readiness"><h2>Belum ada penanganan yang akan diuji</h2><p>Tambahkan penanganan untuk mulai membandingkan rencana.</p><button onClick={()=>go('interventions')}>Tambah penanganan<ArrowRight size={16}/></button></div>}
              {project.optionGroups.some(g=>g.enabled)&&<Missing title="Belum ada alternatif" action="Lengkapi opsi dan batas" onAction={() => go("interventions")}/>}</> :
              <ComparisonWorkbench key={`alternatives-${project.id}`} project={project} items={rows} scenarioId={scenario} chosen={chosen} initialIds={comparisonIds} highlightPlanIds={runoffHighlightIds} onPinsChange={setComparisonIds} onChoose={selectPlan} tools={<div className="alternatives-context"><button className={`text-button ${search.rejected ? 'search-warning-link' : ''}`} onClick={() => setSearchDetailsOpen(true)}>{search.rejected ? `${search.rejected} paket tersisih · Lihat alasan` : 'Dasar pencarian & pilihan tersisih'}</button><button className="text-button" onClick={() => go("interventions")}>Ubah batas</button></div>} renderDetails={id => {
                const row = rows.find(r => r.id === id)!;
                return <><AlternativeExplanation candidate={{ plan:row.plan, balance:row.balance }} peers={rows.map(r => ({ plan:r.plan, balance:r.balance }))}/><PackageOutcome project={project} plan={row.plan} scenario={scenario} compact/></>;
              }}/>
            }
            {searchDetailsOpen && <ContextDialog title="Dasar pencarian & pilihan tersisih" className="search-method-dialog" onClose={() => setSearchDetailsOpen(false)}>
              <div className="search-method-summary" aria-label="Ringkasan pencarian"><div><span>Diperiksa</span><strong>{search.evaluated}/{search.declared}</strong><small>kemungkinan</small></div><div><span>Batas biaya</span><strong>{limits.budget === null ? "—" : money(limits.budget)}</strong><small>{limits.budget === null ? "belum diketahui" : "maksimum"}</small></div><div><span>Lahan</span><strong>{limits.land === null ? "—" : `${fmt(limits.land)} m²`}</strong><small>{limits.land === null ? "belum diketahui" : "tersedia"}</small></div><div><span>Tersisih</span><strong>{search.rejected + search.dominated}</strong><small>kombinasi</small></div></div>
              <p className="search-method-intro">Setiap opsi aktif diuji dengan dan tanpa intervensi tersebut; {project.manualPlans.length} varian paket tersimpan juga diuji. Hujan aktif menentukan perbandingan Pareto.</p>
              <SearchExplanation search={search} rainfall={baseline?.baseline.rainfallMm ?? null}/>
              <p className="search-method-footnote">Penyaringan Pareto memakai sisa limpasan, biaya, dan lahan sebelum pembulatan, tanpa skor gabungan.</p>
              <CalculationSource method="pareto"/>
            </ContextDialog>}
          </> : <section className="plan-empty comparison-rain-gate"><CloudRain size={40}/><h2>Isi hujan aktif</h2><p>Satu skenario hujan yang valid cukup untuk membandingkan paket.</p><button className="primary" onClick={() => go("rain")}>Atur skenario hujan<ArrowRight size={17}/></button></section>)}
          {route === "compare" && (
            <>

              {!rows.length && <Missing title="Belum ada alternatif untuk dibandingkan" action="Lengkapi opsi dan batas" onAction={() => go("interventions")} />}
              <ComparisonWorkbench key={project.id} project={project} items={rows} scenarioId={scenario} chosen={chosen} initialIds={comparisonIds} highlightPlanIds={runoffHighlightIds} onPinsChange={setComparisonIds} onChoose={selectPlan} />
              <ProjectSources project={project} />
            </>
          )}
          {route === "impact" && (
            <>
              {selectedPackage && !fieldState.selected.ready && <FieldDecisionReadiness state={fieldState} scope="selected" onAction={a=>{setGuideOpen(false);revealIssue(a);}}/>}
              {!selectedPackage ? (
                <div className="plan-empty">
                  <FileCheck2 size={42} />
                  <h2>Rencana belum dipilih</h2>
                  <p>
                    Bandingkan biaya, lahan, dan sisa limpasan, lalu pilih paket di Alternatif.
                  </p>
                  {<button className="primary" onClick={() => go("alternatives")}>{"Lihat alternatif rencana"}<ArrowRight size={17}/></button>}
                </div>
              ) : (
                <>
                  <div className="plan-masthead" aria-label="Ringkasan rencana pilihan">
                    <section className="plan-mast-cell plan-mast-choice">
                      <FileCheck2 size={34} aria-hidden="true"/>
                      <div><strong>{selectedDefinition!.components.filter(c=>c.enabled).map(c=>c.name).join(' + ') || selectedPackage.name}</strong><span>{selectedPackage.name}</span><small>{project.name} · {parcelArea === null ? "luas belum diketahui" : `${fmt(parcelArea)} m²`} · {project.zones.length} zona</small></div>
                    </section>
                    <section className="plan-mast-cell plan-mast-rain">
                      <CloudRain size={32} aria-hidden="true"/>
                      <div><span>Hujan uji</span><strong>{planResult ? `${fmt(planResult.baseline.rainfallMm)} mm` : '—'}</strong></div>
                    </section>
                    <section className="plan-mast-cell plan-mast-runoff">
                      <Droplets size={36} aria-hidden="true"/>
                      <div><span>Limpasan</span>{planResult ? <><strong>{fmt(planResult.baseline.runoffM3)} → {fmt(planResult.residual)} m³</strong><small>{fmt(impactInterpretation!.handled)} m³ tertangani{impactInterpretation!.share!==null&&` · ${fmt(impactInterpretation!.share*100)}%`}</small></> : <strong>Belum dihitung</strong>}</div>
                    </section>
                    <section className="plan-mast-status" aria-label="Status rencana">
                      <span className="is-ok"><Check size={16} aria-hidden="true"/>Limpasan tertangani</span>
                      {selectedChecks.slice(0,2).map(check=><span className="is-pending" key={check.id}><i aria-hidden="true"/>{check.label}</span>)}
                      {!selectedChecks.length&&<span className="is-ok"><Check size={16} aria-hidden="true"/>Data utama rencana lengkap</span>}
                    </section>
                  </div>
                  <PlanWorkbench hasResult={!!planResult} summary={planResult ? onExplain => <PlanSummary project={project} plan={selectedDefinition!} result={planResult} limits={limits} scenario={scenario} onScenario={id => { setEditing(null); setPlacing(null); update({ scenario:id }); }} onExplain={onExplain} onCheck={check=>{setGuideOpen(false);revealIssue({stage:'interventions',componentId:check.componentId,field:check.field,message:check.message});}} onExport={()=>setReportOpen(true)} onCompare={()=>go('alternatives')} stale={decisionStale}/> : undefined} water={planResult ? <PlanWaterFlow result={planResult}/> : null} targets={<PlanTargets project={selectedProject} plan={selectedDefinition!}/>} recommendation={<PlanRecommendationPanel project={project} plan={selectedDefinition!} scenario={scenario} stale={decisionStale}/>} screening={<PlanScreening project={project} plan={selectedDefinition!} scenarioId={scenario}/>} field={<FieldEvaluationPanel project={project} onProject={p => update({ project:p })} onNavigate={go}/> }>
                  {decisionStale && <p role="status" className="feasibility-note invalid">Input berubah sejak rencana dipilih. Definisi pilihan lama tetap disimpan; tinjau alternatif dan pilih kembali sebelum mengunduh.</p>}
                  {planResult ? (
                    <>
                      <section className="decision-meaning" aria-labelledby="decision-meaning-heading">
                        <h3 id="decision-meaning-heading">Hasil perhitungan</h3>
                        <ol className="plan-reading-steps">
                          <li><span>1</span><div><h4>Air tersedia</h4><strong>{fmt(planResult.baseline.runoffM3)} m³</strong><p>Limpasan awal dihitung dari luas, hujan, dan koefisien permukaan. Koefisien memakai nilai yang Anda konfirmasi.</p></div></li>
                          <li><span>2</span><div><h4>Air tertangani</h4><strong>{fmt(impactInterpretation!.handled)} m³</strong><p>Tercatat sebagai tampungan, infiltrasi{planResult.reused > 0 ? ", atau pemanfaatan selama kejadian" : ""}. Tampungan belum berarti air dimanfaatkan; air yang sama tidak dihitung dua kali.</p></div></li>
                          <li><span>3</span><div><h4>Air tersisa</h4><strong>{fmt(planResult.residual)} m³</strong><p>Masih menjadi limpasan pada neraca ini. Penurunan volume belum membuktikan genangan hilang; jalur keluar, tanah, dan kondisi lapangan perlu ditinjau.</p></div></li>
                        </ol>
                      </section>
                      <DecisionConclusion project={project} plan={selectedDefinition!} scenario={scenario} stale={decisionStale} onCompare={() => go("alternatives")} onRefine={() => go("interventions")} peers={rows.map(r => ({ plan: r.plan, balance: r.balance }))} onNote={note => { if (project.selectedPlan && note !== project.selectedPlan.decisionNote) update({ project: { ...project, selectedPlan: { ...project.selectedPlan, decisionNote: note } } }); }} />
                      {!planResult.feasible && (
                        <div className="feasibility-note invalid">
                          <X size={19} />
                          <span>
                            Rencana kini melampaui batas:{" "}
                            {planResult.reasons.join(". ")}. Periksa kembali
                            pilihan sebelum mengunduh.
                          </span>
                        </div>
                      )}
                      {selectedDefinition && <ProjectScenarioChart project={project} plans={[{ id: chosen ?? "selected-plan", name: selectedDefinition.name, plan: selectedDefinition }]} />}
                      <section className="robustness">
                        <div>
                          <h3>Rencana yang sama, {project.scenarios.length} skenario hujan</h3>
                          <span>
                            Isi kapasitas pada setiap skenario hujan untuk melihat hasilnya.
                          </span>
                        </div>
                        {project.scenarios.map((s) => {
                          const evaluated = selectedDefinition ? evaluatePlan(project, selectedDefinition, s.id) : null;
                          const r = evaluated?.ok ? evaluationFromBalance(project, s.id, evaluated.value) : null;
                          return (
                            <button
                              key={s.id}
                              aria-pressed={s.id === scenario}
                              onClick={() => { setEditing(null); setPlacing(null); update({ scenario: s.id }); }}
                            >
                              <CloudRain size={19} />
                              <span>
                                {r
                                  ? `${fmt(r.baseline.rainfallMm)} mm`
                                  : "Input belum lengkap"}
                              </span>
                              <strong>
                                {r ? `${fmt(r.residual)} m³` : "—"}
                              </strong>
                              <small>sisa limpasan</small>
                            </button>
                          );
                        })}
                      </section>
                      <details className="decision-provenance plan-data-provenance" open>
                        <summary>Data perhitungan</summary>
                        <div>
                          <p><strong>Persil.</strong> {parcelArea === null ? "Luas belum diketahui." : `${fmt(parcelArea)} m² · ${evidenceLabel(selectedProject.parameters.find(p => p.id === selectedProject.parcel?.area.id)?.evidence ?? "UNKNOWN")}${selectedProject.parameters.find(p => p.id === selectedProject.parcel?.area.id)?.source ? ` · ${selectedProject.parameters.find(p => p.id === selectedProject.parcel?.area.id)?.source}` : ""}`}</p>
                          <p><strong>Hujan.</strong> {fmt(planResult.baseline.rainfallMm)} mm · {evidenceLabel(selectedProject.parameters.find(p => p.id === selectedProject.scenarios.find(s => s.id === scenario)?.rainfall.id)?.evidence ?? "UNKNOWN")} · {selectedProject.parameters.find(p => p.id === selectedProject.scenarios.find(s => s.id === scenario)?.rainfall.id)?.source || "sumber belum dicatat"}</p>
                          <p><strong>Zona.</strong></p>
                          <ul tabIndex={0}>{selectedProject.zones.map(z => {
                            const coefficient = selectedProject.parameters.find(p => p.id === z.coefficient.id);
                            return <li key={z.id}>{z.name}: {z.surface ? surfaceLabels[z.surface] : "kelas belum diketahui"}; C {coefficient?.value ?? "belum diketahui"} · {evidenceLabel(coefficient?.evidence ?? "UNKNOWN")}{coefficient?.source ? ` · ${coefficient.source}` : ""}</li>;
                          })}</ul>
                          <p><strong>Intervensi.</strong></p>
                          {selectedPackage.optionIds.length ? <ul tabIndex={0}>{selectedPackage.optionIds.map(id => {
                            const values = componentEditorValues(selectedProject, id, scenario);
                            const target = values?.component.targets.map(targetId => project.zones.find(z => z.id === targetId)?.name ?? "zona terhapus").join(", ") || "target belum dinyatakan";
                            return values ? <li key={id}>{values.component.name} → {target}; kapasitas {values.capacity.text || "belum diketahui"} m³/event; biaya {values.cost.text ? money(Number(values.cost.text)) : "belum diketahui"}; lahan {values.area.text || "belum diketahui"} m².</li> : null;
                          })}</ul> : <p>Tidak ada intervensi pada rencana ini.</p>}
                          {impactPhotoProvenance.length > 0 && <><p><strong>Analisis foto yang tertaut.</strong></p><ul tabIndex={0}>{impactPhotoProvenance.map(item => <li key={item}>{item}</li>)}</ul></>}
                        </div>
                      </details>
                      <details className="decision-provenance plan-check-provenance" open>
                        <summary>Masih perlu diverifikasi</summary>
                        {impactVerification.length ? <ul tabIndex={0}>{impactVerification.map(item => <li key={item}>{item}</li>)}</ul> : <p>Tidak ada nilai rencana berstatus asumsi yang terdeteksi pada data yang ditinjau.</p>}
                        <p className="quiet">Sebelum desain konstruksi, verifikasi dimensi, kondisi sambungan, kapasitas, biaya, dan kondisi lapangan dengan pihak yang berwenang.</p>
                      </details>
                      <div className="decision-footnotes">
                        <div>
                          <h3>Pemeriksaan lapangan</h3>
                          <p>
                            Gunakan catatan sumber di atas untuk meninjau
                            rencana. Verifikasi kondisi dan kelayakan lapangan
                            sebelum masuk ke desain konstruksi.
                          </p>
                          <ProjectSources project={project} />
                        </div>
                        <div className="decision-export">
                          <span>Ringkasan pra-perencanaan</span>
                          <p>
                            Rencana, hasil per hujan, input, sumber dan batas
                            perhitungan dalam satu dokumen.
                          </p>

                        </div>
                      </div>
                    </>
                  ) : (
                    <DecisionConclusion project={project} plan={selectedDefinition!} scenario={scenario} stale={decisionStale} onCompare={() => go("alternatives")} onRefine={() => go("interventions")} peers={rows.map(r => ({ plan: r.plan, balance: r.balance }))} onNote={note => { if (project.selectedPlan && note !== project.selectedPlan.decisionNote) update({ project: { ...project, selectedPlan: { ...project.selectedPlan, decisionNote: note } } }); }} />
                  )}
                  </PlanWorkbench>
                </>
              )}
            </>
          )}

          </>}
          {navigatorOpen&&store.active&&<div className="navigator-modal-backdrop" data-closing={navigatorClosing||undefined} role="dialog" aria-modal="true" aria-label="Navigator TIRTA" onPointerDown={event=>{if(event.target!==event.currentTarget)return;closeNavigator(()=>history.replaceState(null,'',`?view=${route}`));}}><div className="navigator-modal-shell"><button className="navigator-modal-close" aria-label="Tutup Navigator" onClick={()=>closeNavigator(()=>history.replaceState(null,'',`?view=${route}`))}><X size={18}/></button>{navigatorView}</div></div>}
        </main>
      </div>

    </div>
  );
}
type RainEditorDraft = { rainRaw: string; basis: "assumption" | "reference"; sourceText: string; showAssumptionNote: boolean; dirty: boolean };
function RainEditor({
  remembered,
  onDraftChange,
  value,
  source,
  evidence,
  onApply,
  missing = false,
  scenarios,
}: {
  scenarios: ReactNode;
  remembered?: RainEditorDraft;
  onDraftChange: (draft: RainEditorDraft | null) => void;
  missing?: boolean;
  value: number | null;
  source: string;
  evidence: string;
  onApply: (rainRaw: string, sourceText: string, basis: "assumption" | "reference") => boolean;
}) {
  const assumptionPrefix = "Skenario uji yang ditentukan pengguna, bukan prediksi cuaca.";
  const initialBasis: "assumption" | "reference" = evidence === "ASSUMPTION" || evidence === "DEMO" || evidence === "UNKNOWN" ? "assumption" : "reference";
  const [rainRaw, setRainRaw] = useState(remembered?.rainRaw ?? (value === null ? "" : String(value)));
  const [basis, setBasis] = useState<"assumption" | "reference">(remembered?.basis ?? initialBasis);
  const initialSourceText = initialBasis === "assumption" && source.startsWith(assumptionPrefix) ? source.slice(assumptionPrefix.length).trim() : source;
  const [sourceText, setSourceText] = useState(remembered?.sourceText ?? initialSourceText);
  const [showAssumptionNote, setShowAssumptionNote] = useState(remembered?.showAssumptionNote ?? (initialBasis === "assumption" && Boolean(initialSourceText)));
  const [dirty, setDirty] = useState(remembered?.dirty ?? false);
  const [error, setError] = useState(false);
  const pending=dirty&&(value===null||!rainRaw.trim()||Number(rainRaw)!==value||basis!==initialBasis||sourceText!==initialSourceText);
  const remember = (change: Partial<RainEditorDraft>) => onDraftChange({ rainRaw, basis, sourceText, showAssumptionNote, dirty, ...change });
  return (
    <>
      <label className="rain-number">
        Tinggi hujan
        <div>
          <input
            aria-label="Kedalaman hujan"
            aria-invalid={(missing && value === null) || error || undefined}
            aria-describedby="rain-help"
            type="number"
            min="0"
            step="0.1"
            value={rainRaw}
            placeholder="?"
            onChange={(event) => {
              setRainRaw(event.target.value);
              setDirty(true);
              remember({ rainRaw: event.target.value, dirty: true });
            }}
          />
          <span>mm</span>
        </div>
      </label>
      <small id="rain-help">Kosong = belum diketahui · 0 mm = tanpa hujan.{missing && value === null && <span className="field-error"> Isi dan terapkan hujan sebelum melanjutkan.</span>}</small>
      <fieldset className="rain-basis"><legend className="visually-hidden">Dasar hujan</legend>{(["assumption", "reference"] as const).map(mode => <label key={mode}><input type="radio" name="rainBasis" value={mode} checked={basis === mode} onChange={() => {
        setBasis(mode); remember({ basis: mode, sourceText: "", showAssumptionNote: false, dirty: true }); setSourceText(""); setShowAssumptionNote(false); setDirty(true); setError(false);
      }}/>{mode === "assumption" ? "Skenario uji saya" : "Data / referensi hujan"}</label>)}</fieldset>
      {scenarios}
      <small className="rain-basis-help">{basis === "assumption" ? "Angka uji Anda, bukan ramalan cuaca." : "Cantumkan asal data hujan di bawah."}</small>
      {basis === "reference" || showAssumptionNote ? (
        <label>
          {basis === "reference" ? "Sumber data hujan" : "Catatan skenario"}
          <textarea
            aria-label="Sumber hujan"
            aria-invalid={(error && basis === "reference" && !sourceText.trim()) || undefined}
            aria-describedby={error ? "rain-error" : undefined}
            rows={basis === "reference" ? 3 : 2}
            value={sourceText}
            placeholder={basis === "reference" ? "Contoh: data stasiun atau dokumen acuan" : "Contoh: hujan uji untuk membandingkan respons persil"}
            onChange={(event) => {
              setSourceText(event.target.value);
              setDirty(true);
              remember({ sourceText: event.target.value, dirty: true });
            }}
          />
        </label>
      ) : (
        <button type="button" className="rain-note-toggle" onClick={() => { setShowAssumptionNote(true); remember({ showAssumptionNote: true }); }}>+ Tambah catatan</button>
      )}
      {pending && value !== null && <small className="rain-pending-note">Belum diterapkan — hasil di bawah masih memakai {fmt(value)} mm.</small>}
      {pending ? <button
        type="button"
        className="rain-apply"
        aria-label="Terapkan hujan & hitung ulang"
        onClick={() => {
          if (onApply(rainRaw, sourceText, basis)) { setDirty(false); setError(false); onDraftChange(null); }
          else setError(true);
        }}
      >
        Terapkan hujan
      </button> : value !== null && <p className="rain-applied" role="status"><Check size={16} aria-hidden="true"/>Hujan {fmt(value)} mm sudah diterapkan</p>}
      {error && <p className="field-error" id="rain-error" role="alert">{basis === "reference" ? "Hujan harus nol atau positif dan data referensi memerlukan sumber." : "Hujan harus nol atau positif."} Input Anda belum diterapkan.</p>}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<TirtaHelpProvider><App /></TirtaHelpProvider>);
void discardRetiredModelCache();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/tirta-sw.js", { updateViaCache: "none" }).then(registration => registration.update()).catch(() => { /* Saving remains available if offline installation is unavailable. */ });
}
